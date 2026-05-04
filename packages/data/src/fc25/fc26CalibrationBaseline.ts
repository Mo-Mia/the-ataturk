import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  CALIBRATION_TARGETS,
  simulateMatch,
  type MatchConfigV2,
  type MatchDuration,
  type MatchSnapshot,
  type MatchTick,
  type SubstitutionSummary,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";
import { TICKS_PER_FULL_MATCH } from "../../../match-engine/src/calibration/constants";
import { SCORE_STATE } from "../../../match-engine/src/calibration/probabilities";
import { buildSnapshot, emitFullTime, toMatchTick } from "../../../match-engine/src/snapshot";
import { buildInitState } from "../../../match-engine/src/state/initState";
import { recordScoreStateEvent } from "../../../match-engine/src/state/scoreState";
import { runTick } from "../../../match-engine/src/ticks/runTick";

import { getDb, type SqliteDatabase } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25DatasetVersion, Fc25SquadPlayer } from "../types";
import { getActiveFc25DatasetVersion, listFc25Clubs, loadFc25Squad } from "./importer";
import { rotatedLiverpoolXi } from "./realSquadResponsiveness";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/calibration-baseline-fc26.json";
const EXPECTED_SOURCE_FILE = "FC26_20250921.csv";
const EXPECTED_COUNTS = {
  arsenal: 24,
  "aston-villa": 24,
  liverpool: 28,
  "manchester-city": 26,
  "manchester-united": 26
} satisfies Partial<Record<Fc25ClubId, number>>;
type BaselineClubId = keyof typeof EXPECTED_COUNTS & Fc25ClubId;
const BASELINE_CLUBS = Object.keys(EXPECTED_COUNTS) as BaselineClubId[];
const HOME_CLUB: BaselineClubId = "liverpool";
const AWAY_CLUB: BaselineClubId = "manchester-city";
const BASELINE_FORMATION: SupportedFormation = "4-3-3";
const BASELINE_TACTICS: TeamTactics = {
  formation: BASELINE_FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};
const PHASE8_CHARACTERISATION = {
  second_half: { shots: 10.45, goals: 1.63, fouls: 5.18, cards: 1.43 },
  full_90: { shots: 18.06, goals: 2.73, fouls: 9.62, cards: 2.77 }
};
const PHASE8_RESPONSIVENESS = {
  Mentality: 131.02094240837692,
  Pressing: 257.3770491803279,
  Tempo: -18.505104138837588,
  "Fatigue impact": -3.5376542684524086,
  "Auto Subs impact": 4.87,
  "Score-state shot impact": 29.743589743589737,
  "Chance creation isolated": -7.14,
  "Manual XI rotation": -15.92632719393283
};

export interface Fc26CalibrationBaselineOptions {
  outputPath?: string;
  characterisationSeeds?: number;
  responsivenessSeeds?: number;
  manualXiSeeds?: number;
  sanitySeeds?: number;
  databasePath?: string;
  gitSha?: string;
}

export interface Fc26CalibrationBaselineReport {
  schemaVersion: 1;
  generatedAt: string;
  gitSha: string;
  dataset: {
    id: string;
    name: string;
    sourceFile: string;
    sourceFileSha256: string;
    createdAt: string;
    squadCounts: Record<BaselineClubId, number>;
  };
  sanity: {
    seeds: number;
    pass: boolean;
    activePlayersPerClub: Record<BaselineClubId, number>;
    lineupWarnings: string[];
    full90: Pick<CharacterisationRow, "metrics" | "standardErrors" | "scoreDistribution">;
  };
  characterisation: CharacterisationRow[];
  responsiveness: ResponsivenessRow[];
  manualXi: ManualXiRow;
  classifications: ClassificationRow[];
  synthesis: {
    bucket1: number;
    bucket2: number;
    bucket3: number;
    recommendation: string;
  };
}

export interface CharacterisationRow {
  id: string;
  duration: MatchDuration;
  seeds: number;
  matchup: { home: Fc25ClubId; away: Fc25ClubId };
  metrics: CoreMetrics;
  standardErrors: CoreMetrics;
  targets: Record<keyof CoreMetrics, [number, number]>;
  setPieces: SetPieceMetrics;
  scoreDistribution: Array<{ score: string; count: number; sharePct: number }>;
  pass: boolean;
}

export interface ResponsivenessRow {
  name: string;
  metric: string;
  seeds: number;
  baselineLabel: string;
  variantLabel: string;
  baselineAverage: number;
  variantAverage: number;
  deltaPct: number | null;
  standardErrorPct: number;
  thresholdPct: number | null;
  status: "PASS" | "FAIL" | "DIAGNOSTIC";
  phase8DeltaPct: number | null;
}

export interface ManualXiRow {
  name: "Manual XI rotation";
  seeds: number;
  baselineAverage: number;
  variantAverage: number;
  pairedGoalDeltaAverage: number;
  pairedGoalDeltaStandardError: number;
  deltaPct: number;
  standardErrorPct: number;
  confidenceInterval95Pct: [number, number];
  removedPlayers: PlayerSummary[];
  addedPlayers: PlayerSummary[];
  thresholdPct: 7;
  status: "PASS" | "FAIL";
  phase8DeltaPct: number;
}

export interface ClassificationRow {
  metric: string;
  bucket: 1 | 2 | 3;
  fc26Value: number;
  phase8Value: number | null;
  rationale: string;
  recommendation: string;
}

interface PlayerSummary {
  id: string;
  name: string;
  overall: number;
  position: string;
  squadNumber: number | undefined;
}

interface CoreMetrics {
  shots: number;
  goals: number;
  fouls: number;
  cards: number;
}

interface SetPieceMetrics {
  corners: number;
  directFreeKicks: number;
  indirectFreeKicks: number;
  penalties: number;
  setPieceGoals: number;
  penaltyGoals: number;
  penaltyConversionPct: number;
}

interface RunMetrics {
  seed: number;
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  totalShots: number;
  homeShots: number;
  awayShots: number;
  totalFouls: number;
  homeFouls: number;
  totalCards: number;
  homePossession: number;
  homePossessionStreak: number;
  homeWideDeliveries: number;
  homeFinal15Shots: number;
  lateActionSuccessRate: number;
  final15AverageUrgency: number;
  substitutions: number;
  setPieceEvents: number;
  setPieceGoals: number;
  corners: number;
  directFreeKicks: number;
  indirectFreeKicks: number;
  penalties: number;
  penaltyGoals: number;
  score: string;
  substitutionEvents: Array<SubstitutionSummary & { teamId: "home" | "away"; seed: number }>;
}

interface Context {
  version: Fc25DatasetVersion;
  squadCounts: Record<BaselineClubId, number>;
  squads: Record<BaselineClubId, LoadedSquad>;
}

interface LoadedSquad {
  clubId: BaselineClubId;
  clubName: string;
  shortName: string;
  players: Fc25SquadPlayer[];
}

export function runFc26CalibrationBaseline(
  options: Fc26CalibrationBaselineOptions = {}
): Fc26CalibrationBaselineReport {
  const db = getDb(options.databasePath);
  const context = buildContext(db);
  const sanitySeeds = options.sanitySeeds ?? 50;
  const characterisationSeeds = options.characterisationSeeds ?? 200;
  const responsivenessSeeds = options.responsivenessSeeds ?? 200;
  const manualXiSeeds = options.manualXiSeeds ?? 1000;

  const sanity = runSanity(context, sanitySeeds);
  if (!sanity.pass) {
    throw new Error("FC26 baseline sanity check failed");
  }

  const characterisation = [
    characterise(context, "second_half", characterisationSeeds),
    characterise(context, "full_90", characterisationSeeds)
  ];
  const responsiveness = runResponsiveness(context, responsivenessSeeds);
  const manualXi = runManualXi(context, manualXiSeeds);
  const classifications = [
    ...classifyCharacterisation(characterisation),
    ...classifyResponsiveness(responsiveness),
    classifyManualXi(manualXi)
  ];
  const synthesis = synthesisFor(classifications);
  const report: Fc26CalibrationBaselineReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitSha: options.gitSha ?? "unknown",
    dataset: {
      id: context.version.id,
      name: context.version.name,
      sourceFile: context.version.source_file,
      sourceFileSha256: context.version.source_file_sha256,
      createdAt: context.version.created_at,
      squadCounts: context.squadCounts
    },
    sanity,
    characterisation,
    responsiveness,
    manualXi,
    classifications,
    synthesis
  };

  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function classifyCharacterisation(rows: CharacterisationRow[]): ClassificationRow[] {
  return rows.flatMap((row) =>
    (Object.keys(row.metrics) as Array<keyof CoreMetrics>).map((metric) => {
      const fc26Value = row.metrics[metric];
      const phase8Value = PHASE8_CHARACTERISATION[row.duration as "second_half" | "full_90"][metric];
      const withinTarget = inRange(fc26Value, row.targets[metric]);
      const withinOneSe = Math.abs(fc26Value - phase8Value) <= row.standardErrors[metric];
      if (withinTarget && withinOneSe) {
        return {
          metric: `${row.duration} ${metric}`,
          bucket: 1,
          fc26Value,
          phase8Value,
          rationale: "FC26 mean is within target band and within one FC26 standard error of Phase 8.",
          recommendation: "No action."
        };
      }
      if (withinTarget) {
        return {
          metric: `${row.duration} ${metric}`,
          bucket: 2,
          fc26Value,
          phase8Value,
          rationale:
            "FC26 remains inside the existing calibration target but differs from the Phase 8 mean by more than one FC26 standard error.",
          recommendation: "Accept as FC26 baseline drift; update documented bands only if future tests need FC26-specific thresholds."
        };
      }
      return {
        metric: `${row.duration} ${metric}`,
        bucket: 3,
        fc26Value,
        phase8Value,
        rationale: "FC26 falls outside the current calibration target band.",
        recommendation: `Surface for Mo/SA call before tuning; inspect ${metric} probability and FC26 attribute-distribution interaction.`
      };
    })
  );
}

export function classifyResponsiveness(rows: ResponsivenessRow[]): ClassificationRow[] {
  return rows.map((row) => {
    if (row.status === "PASS") {
      return {
        metric: row.name,
        bucket: 1,
        fc26Value: row.deltaPct ?? row.variantAverage,
        phase8Value: row.phase8DeltaPct,
        rationale: "FC26 responsiveness passes the existing threshold.",
        recommendation: "No action."
      };
    }
    if (row.status === "DIAGNOSTIC") {
      return {
        metric: row.name,
        bucket: 2,
        fc26Value: row.deltaPct ?? row.variantAverage,
        phase8Value: row.phase8DeltaPct,
        rationale: "Diagnostic-only metric has no current pass/fail gate.",
        recommendation: "Document FC26 baseline; avoid adding a threshold without UAT need."
      };
    }
    return {
      metric: row.name,
      bucket: 3,
      fc26Value: row.deltaPct ?? row.variantAverage,
      phase8Value: row.phase8DeltaPct,
      rationale: "FC26 responsiveness did not clear the existing threshold.",
      recommendation: `Surface for Mo/SA call; inspect ${row.metric} and related tactic or dynamics path before tuning.`
    };
  });
}

export function classifyManualXi(row: ManualXiRow): ClassificationRow {
  if (row.status === "PASS") {
    return {
      metric: row.name,
      bucket: 1,
      fc26Value: row.deltaPct,
      phase8Value: row.phase8DeltaPct,
      rationale: "FC26 top-three-out manual XI impact clears the Phase 9-widened 7% threshold.",
      recommendation: "No action."
    };
  }
  return {
    metric: row.name,
    bucket: 3,
    fc26Value: row.deltaPct,
    phase8Value: row.phase8DeltaPct,
    rationale: "FC26 top-three-out manual XI impact does not clear the 7% threshold.",
    recommendation: "Surface for Mo/SA call; inspect XI selector, position fit, and personnel-impact absorption."
  };
}

function buildContext(db: SqliteDatabase): Context {
  const version = getActiveFc25DatasetVersion(db);
  if (!version) {
    throw new Error("No active FC dataset version is available");
  }
  if (!version.source_file.includes(EXPECTED_SOURCE_FILE)) {
    throw new Error(
      `Active FC dataset '${version.id}' is not the expected FC26 import (${EXPECTED_SOURCE_FILE})`
    );
  }
  assertFc26Columns(db);
  const clubs = listFc25Clubs(version.id, db);
  const squadCounts = Object.fromEntries(
    BASELINE_CLUBS.map((clubId) => [
      clubId,
      clubs.some((club) => club.id === clubId)
        ? db
            .prepare<[string, string], { count: number }>(
              "SELECT COUNT(*) AS count FROM fc25_squads WHERE dataset_version_id = ? AND club_id = ?"
            )
            .get(version.id, clubId)?.count ?? 0
        : 0
    ])
  ) as Record<BaselineClubId, number>;

  for (const [clubId, expected] of Object.entries(EXPECTED_COUNTS) as Array<[BaselineClubId, number]>) {
    if (squadCounts[clubId] !== expected) {
      throw new Error(
        `Expected ${expected} FC26 squad rows for ${clubId}, found ${squadCounts[clubId] ?? 0}`
      );
    }
  }

  return {
    version,
    squadCounts,
    squads: Object.fromEntries(
      BASELINE_CLUBS.map((clubId) => [clubId, loadSquad(clubId, version.id, db)])
    ) as Record<BaselineClubId, LoadedSquad>
  };
}

function assertFc26Columns(db: SqliteDatabase): void {
  const rows = db.prepare("PRAGMA table_info(fc25_players)").all() as Array<{ name: string }>;
  const names = new Set(rows.map((row) => row.name));
  for (const column of ["work_rate", "position_ratings_json", "value_eur", "player_traits"]) {
    if (!names.has(column)) {
      throw new Error(`FC26 metadata column '${column}' is missing; run migrations first`);
    }
  }
}

function loadSquad(clubId: BaselineClubId, versionId: string, db: SqliteDatabase): LoadedSquad {
  return { ...loadFc25Squad(clubId, versionId, { include: "all", db }), clubId };
}

function runSanity(
  context: Context,
  seeds: number
): Fc26CalibrationBaselineReport["sanity"] {
  const lineupWarnings: string[] = [];
  const activePlayersPerClub = {} as Record<BaselineClubId, number>;
  for (const clubId of BASELINE_CLUBS) {
    const lineup = selectLineup(context.squads[clubId].players, BASELINE_FORMATION);
    activePlayersPerClub[clubId] = lineup.xi.length;
    lineupWarnings.push(
      ...lineup.warnings.map((warning) => `${clubId}:${warning.code}:${warning.playerId}`)
    );
  }
  const runs = runSeeds(seeds, (seed) => simulate(context, seed, "full_90"));
  return {
    seeds,
    pass:
      Object.values(activePlayersPerClub).every((count) => count === 11) &&
      lineupWarnings.length === 0,
    activePlayersPerClub,
    lineupWarnings,
    full90: {
      metrics: coreMetrics(runs),
      standardErrors: coreStandardErrors(runs),
      scoreDistribution: scoreDistribution(runs)
    }
  };
}

function characterise(
  context: Context,
  duration: MatchDuration,
  seeds: number
): CharacterisationRow {
  const runs = runSeeds(seeds, (seed) => simulate(context, seed, duration));
  const targets = targetsForDuration(duration);
  const metrics = coreMetrics(runs);
  const standardErrors = coreStandardErrors(runs);
  const scoreRows = scoreDistribution(runs);
  const pass =
    inRange(metrics.shots, targets.shots) &&
    inRange(metrics.goals, targets.goals) &&
    inRange(metrics.fouls, targets.fouls) &&
    inRange(metrics.cards, targets.cards) &&
    (scoreRows[0]?.sharePct ?? 0) <= CALIBRATION_TARGETS.maxSingleScoreShare * 100;
  return {
    id: `${duration}_fc26_${seeds}`,
    duration,
    seeds,
    matchup: { home: HOME_CLUB, away: AWAY_CLUB },
    metrics,
    standardErrors,
    targets,
    setPieces: setPieceMetrics(runs),
    scoreDistribution: scoreRows,
    pass
  };
}

function runResponsiveness(context: Context, seeds: number): ResponsivenessRow[] {
  const liverpoolCity = context;
  return [
    compareScenario({
      name: "Mentality",
      baselineLabel: "Liverpool defensive",
      variantLabel: "Liverpool attacking",
      metric: "homeShots",
      thresholdPct: 30,
      seeds,
      baseline: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { mentality: "defensive" } }),
      variant: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { mentality: "attacking" } })
    }),
    compareScenario({
      name: "Pressing",
      baselineLabel: "Liverpool low pressing",
      variantLabel: "Liverpool high pressing",
      metric: "homeFouls",
      thresholdPct: 20,
      seeds,
      baseline: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { pressing: "low" } }),
      variant: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { pressing: "high" } })
    }),
    compareScenario({
      name: "Tempo",
      baselineLabel: "Liverpool slow tempo",
      variantLabel: "Liverpool fast tempo",
      metric: "homePossessionStreak",
      thresholdPct: 15,
      seeds,
      baseline: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { tempo: "slow" } }),
      variant: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { tempo: "fast" } })
    }),
    compareScenario({
      name: "Formation",
      baselineLabel: "Liverpool 4-4-2",
      variantLabel: "Liverpool 4-3-3",
      metric: "homeWideDeliveries",
      thresholdPct: null,
      seeds,
      baseline: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { formation: "4-4-2" } }),
      variant: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { homeTactics: { formation: "4-3-3" } })
    }),
    compareScenario({
      name: "Fatigue impact",
      baselineLabel: "Fatigue disabled",
      variantLabel: "Fatigue enabled",
      metric: "lateActionSuccessRate",
      thresholdPct: 3,
      seeds,
      baseline: (seed) => simulate(liverpoolCity, seed, "full_90", { fatigue: false, autoSubs: false }),
      variant: (seed) => simulate(liverpoolCity, seed, "full_90", { fatigue: true, autoSubs: false })
    }),
    compareScenario({
      name: "Auto Subs impact",
      baselineLabel: "Auto Subs OFF",
      variantLabel: "Auto Subs ON",
      metric: "substitutions",
      thresholdPct: null,
      seeds,
      baseline: (seed) => simulate(liverpoolCity, seed, "full_90", { autoSubs: false }),
      variant: (seed) => simulate(liverpoolCity, seed, "full_90", { autoSubs: true }),
      activation: (variant) => {
        const averageSubs = average(variant.map((run) => run.substitutions));
        const zeroSubMatches = variant.filter((run) => run.substitutions === 0).length;
        return averageSubs >= 1 && zeroSubMatches === 0;
      }
    }),
    compareScenario({
      name: "Score-state shot impact",
      baselineLabel: "Tied control",
      variantLabel: "Liverpool trailing 0-2 at 75'",
      metric: "homeFinal15Shots",
      thresholdPct: 15,
      seeds,
      baseline: (seed) => simulate(liverpoolCity, seed, "full_90"),
      variant: (seed) =>
        simulate(liverpoolCity, seed, "full_90", { lateDeficitAt75: { home: 0, away: 2 } })
    }),
    compareScenario({
      name: "Chance creation isolated",
      baselineLabel: "Chance creation disabled",
      variantLabel: "Chance creation enabled",
      metric: "homeFinal15Shots",
      thresholdPct: null,
      seeds,
      baseline: (seed) => simulate(liverpoolCity, seed, "full_90", { chanceCreation: false }),
      variant: (seed) => simulate(liverpoolCity, seed, "full_90", { chanceCreation: true })
    })
  ];
}

function runManualXi(context: Context, seeds: number): ManualXiRow {
  const rotation = rotatedLiverpoolXi(context.squads.liverpool.players, BASELINE_FORMATION);
  const pairs = runSeeds(seeds, (seed) => ({
    autoGoals: simulate(context, seed, "full_90", { autoSubs: false }).homeGoals,
    rotatedGoals: simulate(context, seed, "full_90", {
      autoSubs: false,
      homeStartingPlayerIds: rotation.rotatedIds
    }).homeGoals
  }));
  const autoGoalsAverage = average(pairs.map((pair) => pair.autoGoals));
  const rotatedGoalsAverage = average(pairs.map((pair) => pair.rotatedGoals));
  const deltas = pairs.map((pair) => pair.rotatedGoals - pair.autoGoals);
  const pairedGoalDeltaAverage = average(deltas);
  const pairedGoalDeltaStandardError = standardError(deltas);
  const deltaPct = percentageChange(rotatedGoalsAverage, autoGoalsAverage);
  const standardErrorPct =
    autoGoalsAverage === 0 ? 0 : (pairedGoalDeltaStandardError / autoGoalsAverage) * 100;
  const margin = 1.96 * standardErrorPct;
  const players = new Map(context.squads.liverpool.players.map((player) => [player.id, player]));
  return {
    name: "Manual XI rotation",
    seeds,
    baselineAverage: autoGoalsAverage,
    variantAverage: rotatedGoalsAverage,
    pairedGoalDeltaAverage,
    pairedGoalDeltaStandardError,
    deltaPct,
    standardErrorPct,
    confidenceInterval95Pct: [deltaPct - margin, deltaPct + margin],
    removedPlayers: rotation.removedStarterIds.map((id) => playerSummary(players.get(id)!)),
    addedPlayers: rotation.addedBenchIds.map((id) => playerSummary(players.get(id)!)),
    thresholdPct: 7,
    status: Math.abs(deltaPct) >= 7 ? "PASS" : "FAIL",
    phase8DeltaPct: PHASE8_RESPONSIVENESS["Manual XI rotation"]
  };
}

function compareScenario(options: {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  metric: keyof RunMetrics;
  thresholdPct: number | null;
  seeds: number;
  baseline: (seed: number) => RunMetrics;
  variant: (seed: number) => RunMetrics;
  activation?: (variant: RunMetrics[]) => boolean;
}): ResponsivenessRow {
  const baseline = runSeeds(options.seeds, options.baseline);
  const variant = runSeeds(options.seeds, options.variant);
  const baselineValues = baseline.map((run) => Number(run[options.metric]));
  const variantValues = variant.map((run) => Number(run[options.metric]));
  const baselineAverage = average(baselineValues);
  const variantAverage = average(variantValues);
  const deltaPct = options.activation ? null : percentageChange(variantAverage, baselineAverage);
  const standardErrorPct = pairedDeltaStandardErrorPct(baselineValues, variantValues);
  const status = options.activation
    ? options.activation(variant)
      ? "PASS"
      : "FAIL"
    : options.thresholdPct === null
      ? "DIAGNOSTIC"
      : options.name === "Fatigue impact"
        ? deltaPct! <= -options.thresholdPct
          ? "PASS"
          : "FAIL"
        : Math.abs(deltaPct!) >= options.thresholdPct
          ? "PASS"
          : "FAIL";
  return {
    name: options.name,
    metric: String(options.metric),
    seeds: options.seeds,
    baselineLabel: options.baselineLabel,
    variantLabel: options.variantLabel,
    baselineAverage,
    variantAverage,
    deltaPct,
    standardErrorPct,
    thresholdPct: options.thresholdPct,
    status,
    phase8DeltaPct: PHASE8_RESPONSIVENESS[options.name as keyof typeof PHASE8_RESPONSIVENESS] ?? null
  };
}

function simulate(
  context: Context,
  seed: number,
  duration: MatchDuration,
  overrides: {
    homeTactics?: Partial<TeamTactics>;
    awayTactics?: Partial<TeamTactics>;
    homeStartingPlayerIds?: string[];
    fatigue?: boolean;
    scoreState?: boolean;
    autoSubs?: boolean;
    chanceCreation?: boolean;
    setPieces?: boolean;
    lateDeficitAt75?: { home: number; away: number };
  } = {}
): RunMetrics {
  const homeTactics = { ...BASELINE_TACTICS, ...overrides.homeTactics };
  const awayTactics = { ...BASELINE_TACTICS, ...overrides.awayTactics };
  const config: MatchConfigV2 = {
    seed,
    duration,
    homeTeam: buildTeam(context.squads[HOME_CLUB], homeTactics, overrides.homeStartingPlayerIds),
    awayTeam: buildTeam(context.squads[AWAY_CLUB], awayTactics),
    dynamics: {
      fatigue: overrides.fatigue ?? true,
      scoreState: overrides.scoreState ?? true,
      autoSubs: overrides.autoSubs ?? true,
      chanceCreation: overrides.chanceCreation ?? true,
      setPieces: overrides.setPieces ?? true,
      sideSwitch: true
    },
    ...(duration === "second_half" ? { preMatchScore: { home: 0, away: 3 } } : {})
  };
  const snapshot = overrides.lateDeficitAt75
    ? simulateWithLateDeficit(config, overrides.lateDeficitAt75)
    : simulateMatch(config);
  return metricsFor(seed, snapshot, duration);
}

function buildTeam(
  squad: LoadedSquad,
  tactics: TeamTactics,
  startingPlayerIds?: string[]
): TeamV2 {
  const lineup = selectLineup(squad.players, tactics.formation as SupportedFormation, startingPlayerIds);
  return {
    id: squad.clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: lineup.xi,
    bench: lineup.bench,
    tactics
  };
}

function simulateWithLateDeficit(
  config: MatchConfigV2,
  scoreAt75: { home: number; away: number }
): MatchSnapshot {
  const state = buildInitState(config);
  const ticks: MatchTick[] = [];
  for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
    runTick(state);
    if (state.matchClock.minute === 75 && state.matchClock.seconds === 0) {
      state.score = { ...scoreAt75 };
      state.stats.home.goals = scoreAt75.home;
      state.stats.away.goals = scoreAt75.away;
      recordScoreStateEvent(state);
    }
    if (count === TICKS_PER_FULL_MATCH - 1) {
      emitFullTime(state);
    }
    ticks.push(toMatchTick(state));
  }
  return buildSnapshot(state, config, ticks);
}

function metricsFor(seed: number, snapshot: MatchSnapshot, duration: MatchDuration): RunMetrics {
  const { home, away } = snapshot.finalSummary.statistics;
  const setPieces = snapshot.finalSummary.setPieces;
  const initialHome = duration === "second_half" ? 0 : 0;
  const initialAway = duration === "second_half" ? 3 : 0;
  const setPieceGoals = countPenaltyGoals(snapshot);
  return {
    seed,
    homeGoals: snapshot.finalSummary.finalScore.home - initialHome,
    awayGoals: snapshot.finalSummary.finalScore.away - initialAway,
    totalGoals:
      snapshot.finalSummary.finalScore.home +
      snapshot.finalSummary.finalScore.away -
      initialHome -
      initialAway,
    totalShots: home.shots.total + away.shots.total,
    homeShots: home.shots.total,
    awayShots: away.shots.total,
    totalFouls: home.fouls + away.fouls,
    homeFouls: home.fouls,
    totalCards: home.yellowCards + away.yellowCards + home.redCards + away.redCards,
    homePossession: home.possession,
    homePossessionStreak: average(
      snapshot.ticks
        .filter((tick) => tick.possessionStreak?.teamId === "home")
        .map((tick) => tick.possessionStreak?.ticks ?? 0)
    ),
    homeWideDeliveries: snapshot.ticks.flatMap((tick) => tick.events).filter(
      (event) =>
        event.team === "home" &&
        event.type === "pass" &&
        (event.detail?.passType === "cross" || event.detail?.passType === "cutback")
    ).length,
    homeFinal15Shots: snapshot.ticks
      .flatMap((tick) => tick.events)
      .filter((event) => event.team === "home" && event.type === "shot" && event.minute >= 75)
      .length,
    lateActionSuccessRate: lateActionSuccessRate(snapshot),
    final15AverageUrgency: final15AverageUrgency(snapshot),
    substitutions:
      (snapshot.finalSummary.substitutions?.home.length ?? 0) +
      (snapshot.finalSummary.substitutions?.away.length ?? 0),
    setPieceEvents:
      (setPieces?.home.corners ?? 0) +
      (setPieces?.away.corners ?? 0) +
      (setPieces?.home.directFreeKicks ?? 0) +
      (setPieces?.away.directFreeKicks ?? 0) +
      (setPieces?.home.indirectFreeKicks ?? 0) +
      (setPieces?.away.indirectFreeKicks ?? 0) +
      (setPieces?.home.penalties ?? 0) +
      (setPieces?.away.penalties ?? 0),
    setPieceGoals: (setPieces?.home.setPieceGoals ?? 0) + (setPieces?.away.setPieceGoals ?? 0),
    corners: (setPieces?.home.corners ?? 0) + (setPieces?.away.corners ?? 0),
    directFreeKicks:
      (setPieces?.home.directFreeKicks ?? 0) + (setPieces?.away.directFreeKicks ?? 0),
    indirectFreeKicks:
      (setPieces?.home.indirectFreeKicks ?? 0) + (setPieces?.away.indirectFreeKicks ?? 0),
    penalties: (setPieces?.home.penalties ?? 0) + (setPieces?.away.penalties ?? 0),
    penaltyGoals: setPieceGoals,
    score: `${snapshot.finalSummary.finalScore.home}-${snapshot.finalSummary.finalScore.away}`,
    substitutionEvents: [
      ...(snapshot.finalSummary.substitutions?.home ?? []).map((substitution) => ({
        ...substitution,
        teamId: "home" as const,
        seed
      })),
      ...(snapshot.finalSummary.substitutions?.away ?? []).map((substitution) => ({
        ...substitution,
        teamId: "away" as const,
        seed
      }))
    ]
  };
}

function coreMetrics(runs: RunMetrics[]): CoreMetrics {
  return {
    shots: average(runs.map((run) => run.totalShots)),
    goals: average(runs.map((run) => run.totalGoals)),
    fouls: average(runs.map((run) => run.totalFouls)),
    cards: average(runs.map((run) => run.totalCards))
  };
}

function coreStandardErrors(runs: RunMetrics[]): CoreMetrics {
  return {
    shots: standardError(runs.map((run) => run.totalShots)),
    goals: standardError(runs.map((run) => run.totalGoals)),
    fouls: standardError(runs.map((run) => run.totalFouls)),
    cards: standardError(runs.map((run) => run.totalCards))
  };
}

function targetsForDuration(duration: MatchDuration): Record<keyof CoreMetrics, [number, number]> {
  if (duration === "second_half") {
    return {
      shots: CALIBRATION_TARGETS.shotsTarget,
      goals: CALIBRATION_TARGETS.goalsTarget,
      fouls: CALIBRATION_TARGETS.foulsTarget,
      cards: CALIBRATION_TARGETS.cardsTarget
    };
  }
  return {
    shots: doubleRange(CALIBRATION_TARGETS.shotsTarget),
    goals: doubleRange(CALIBRATION_TARGETS.goalsTarget),
    fouls: doubleRange(CALIBRATION_TARGETS.foulsTarget),
    cards: doubleRange(CALIBRATION_TARGETS.cardsTarget)
  };
}

function setPieceMetrics(runs: RunMetrics[]): SetPieceMetrics {
  const penalties = average(runs.map((run) => run.penalties));
  const penaltyGoals = average(runs.map((run) => run.penaltyGoals));
  return {
    corners: average(runs.map((run) => run.corners)),
    directFreeKicks: average(runs.map((run) => run.directFreeKicks)),
    indirectFreeKicks: average(runs.map((run) => run.indirectFreeKicks)),
    penalties,
    setPieceGoals: average(runs.map((run) => run.setPieceGoals)),
    penaltyGoals,
    penaltyConversionPct: penalties === 0 ? 0 : (penaltyGoals / penalties) * 100
  };
}

function scoreDistribution(runs: RunMetrics[]): Array<{ score: string; count: number; sharePct: number }> {
  const counts = new Map<string, number>();
  for (const run of runs) {
    counts.set(run.score, (counts.get(run.score) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([score, count]) => ({ score, count, sharePct: (count / runs.length) * 100 }))
    .sort((a, b) => b.count - a.count || a.score.localeCompare(b.score))
    .slice(0, 8);
}

function lateActionSuccessRate(snapshot: MatchSnapshot): number {
  const attempts = snapshot.ticks
    .flatMap((tick) => tick.events)
    .filter(
      (event) => event.minute >= 75 && ["pass", "carry", "shot", "save"].includes(event.type)
    );
  if (attempts.length === 0) {
    return 0;
  }
  const successes = attempts.filter((event) => {
    if (event.type === "pass") {
      return event.detail?.complete === true;
    }
    if (event.type === "carry") {
      return event.detail?.progressive === true || event.detail?.carryType === "flank_drive";
    }
    if (event.type === "shot") {
      return event.detail?.onTarget === true;
    }
    return event.type === "save";
  });
  return (successes.length / attempts.length) * 100;
}

function final15AverageUrgency(snapshot: MatchSnapshot): number {
  const samples = snapshot.ticks.filter((tick) => tick.matchClock.minute >= 75);
  return average(
    samples.map((tick) => urgencyForHome(tick.matchClock.minute, tick.score.home, tick.score.away))
  );
}

function countPenaltyGoals(snapshot: MatchSnapshot): number {
  return snapshot.ticks
    .flatMap((tick) => tick.events)
    .filter((event) => {
      if (event.type !== "goal_scored") {
        return false;
      }
      const context = event.detail?.setPieceContext;
      return (
        context &&
        typeof context === "object" &&
        !Array.isArray(context) &&
        (context as { type?: unknown }).type === "penalty"
      );
    }).length;
}

function urgencyForHome(minute: number, homeScore: number, awayScore: number): number {
  const scoreDelta = homeScore - awayScore;
  const minutesRemaining = Math.max(0, 90 - minute);
  const timeFactor =
    minutesRemaining <= 5
      ? SCORE_STATE.timeFactor.last5
      : minutesRemaining <= 15
        ? SCORE_STATE.timeFactor.last15
        : minutesRemaining <= 30
          ? SCORE_STATE.timeFactor.last30
          : SCORE_STATE.timeFactor.early;
  const deficit =
    scoreDelta <= -3
      ? SCORE_STATE.deficitBoost.threePlus
      : scoreDelta === -2
        ? SCORE_STATE.deficitBoost.two
        : scoreDelta === -1
          ? SCORE_STATE.deficitBoost.one
          : 0;
  const level =
    scoreDelta === 0
      ? minutesRemaining <= 5
        ? SCORE_STATE.levelLateBoost.last5
        : minutesRemaining <= 15
          ? SCORE_STATE.levelLateBoost.last15
          : minutesRemaining <= 30
            ? SCORE_STATE.levelLateBoost.last30
            : 0
      : 0;
  const lead = scoreDelta >= 2 ? -0.22 : scoreDelta === 1 ? -0.1 : 0;
  return Math.max(
    SCORE_STATE.minUrgency,
    Math.min(SCORE_STATE.maxUrgency, 1 + (deficit + level + lead) * timeFactor)
  );
}

function playerSummary(player: Fc25SquadPlayer): PlayerSummary {
  return {
    id: player.id,
    name: player.name,
    overall: player.overall,
    position: player.sourcePosition,
    squadNumber: player.squadNumber
  };
}

function synthesisFor(classifications: ClassificationRow[]): Fc26CalibrationBaselineReport["synthesis"] {
  const bucket1 = classifications.filter((row) => row.bucket === 1).length;
  const bucket2 = classifications.filter((row) => row.bucket === 2).length;
  const bucket3 = classifications.filter((row) => row.bucket === 3).length;
  return {
    bucket1,
    bucket2,
    bucket3,
    recommendation:
      bucket3 > 0
        ? "Surface Bucket 3 metrics for Mo/SA discussion before any tuning."
        : bucket2 > 0
          ? "Accept FC26 baseline and update documentation; no tuning sprint required."
          : "Accept FC26 baseline with no further action."
  };
}

function runSeeds<T>(seeds: number, runner: (seed: number) => T): T[] {
  return Array.from({ length: seeds }, (_, index) => runner(index + 1));
}

function inRange(value: number, range: [number, number]): boolean {
  return value >= range[0] && value <= range[1];
}

function doubleRange(value: [number, number]): [number, number] {
  return [value[0] * 2, value[1] * 2];
}

function pairedDeltaStandardErrorPct(baseline: number[], variant: number[]): number {
  const baselineAverage = average(baseline);
  if (baselineAverage === 0) {
    return 0;
  }
  const deltas = variant.map((value, index) => value - baseline[index]!);
  return (standardError(deltas) / baselineAverage) * 100;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardError(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.sqrt(values.length);
}

function percentageChange(next: number, previous: number): number {
  if (previous === 0) {
    return next === 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  return ((next - previous) / previous) * 100;
}
