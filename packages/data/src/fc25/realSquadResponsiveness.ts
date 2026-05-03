import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  simulateMatch,
  type MatchConfigV2,
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

import { getDb } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25SquadPlayer } from "../types";
import { FC25_SOURCE_FILE_DEFAULT } from "./constants";
import { importFc25Dataset, loadFc25Squad } from "./importer";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

type MetricKey =
  | "homeShots"
  | "homeFouls"
  | "homePossessionStreak"
  | "homeGoals"
  | "homePossession"
  | "homeFinal15Shots"
  | "lateActionSuccessRate"
  | "final15AverageUrgency"
  | "setPieceEvents"
  | "setPieceGoals";
type NumericMetricKey = {
  [Key in keyof RunMetrics]: RunMetrics[Key] extends number ? Key : never;
}[keyof RunMetrics];

interface RunMetrics {
  seed: number;
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeFouls: number;
  awayFouls: number;
  homePossessionStreak: number;
  homePossession: number;
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
  scoreStateDiagnostics: ScoreStateDiagnostics;
  substitutionEvents: Array<SubstitutionSummary & { teamId: "home" | "away"; seed: number }>;
}

interface ScoreStateDiagnostics {
  final15AverageUrgency: number;
  final15Actions: Record<string, number>;
  final15PassTypes: Record<string, number>;
  final15Shots: number;
  final15PossessionTicks: number;
}

interface ComparisonResult {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  metric: MetricKey;
  thresholdPct: number;
  baselineAverage: number;
  variantAverage: number;
  deltaPct: number;
  status: "PASS" | "FAIL";
}

interface DiagnosticResult {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  baselineAverages: Record<MetricKey | "homeWideDeliveries", number>;
  variantAverages: Record<MetricKey | "homeWideDeliveries", number>;
  deltaPct: Partial<Record<MetricKey | "homeWideDeliveries", number>>;
}

interface CompositeResult {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  thresholdPct: number;
  shiftedMetrics: Array<{
    metric: MetricKey;
    baselineAverage: number;
    variantAverage: number;
    deltaPct: number;
  }>;
  substitutionDiagnostics?: SubstitutionDiagnostics;
  status: "PASS" | "FAIL";
}

interface SubstitutionDiagnostics {
  averageTotalSubs: number;
  averageHomeSubs: number;
  averageAwaySubs: number;
  zeroSubMatches: number;
  maxSubsInMatch: number;
  minuteBuckets: Record<string, number>;
  reasons: Record<string, number>;
  topReplacements: Array<{ playerOutId: string; playerInId: string; count: number }>;
}

interface SetPieceDiagnostics {
  averageSetPieceEvents: number;
  averageSetPieceGoals: number;
  averageCorners: number;
  averageDirectFreeKicks: number;
  averageIndirectFreeKicks: number;
  averagePenalties: number;
  penaltyConversionPct: number;
}

export interface RealSquadResponsivenessReport {
  generatedAt: string;
  csvPath: string;
  seeds: number;
  matchup: { home: Fc25ClubId; away: Fc25ClubId };
  rotation: {
    description: string;
    removedStarterIds: string[];
    addedBenchIds: string[];
  };
  comparisons: ComparisonResult[];
  diagnostics: DiagnosticResult[];
  phase5: {
    fatigueImpact: ComparisonResult;
    subImpact: CompositeResult;
    scoreStateImpact: ComparisonResult;
    scoreStateDiagnostics: {
      baseline: ScoreStateDiagnostics;
      variant: ScoreStateDiagnostics;
    };
  };
  phase6: {
    chanceCreationImpact: ComparisonResult;
    scoreStateShotImpact: ComparisonResult;
    setPieceImpact: SetPieceDiagnostics;
  };
  pass: boolean;
}

interface Options {
  csvPath?: string;
  seeds?: number;
  outputPath?: string;
}

const DEFAULT_SEEDS = 50;
const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/real-squad-responsiveness-report.json";
const BASELINE_FORMATION: SupportedFormation = "4-3-3";
const BASELINE_TACTICS: TeamTactics = {
  formation: BASELINE_FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

export function runRealSquadResponsiveness(
  options: Options = {}
): RealSquadResponsivenessReport {
  const seeds = options.seeds ?? DEFAULT_SEEDS;
  const csvPath = resolveRepoPath(options.csvPath ?? FC25_SOURCE_FILE_DEFAULT);
  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const tempDir = mkdtempSync(join(tmpdir(), "footsim-real-squad-"));
  const databasePath = join(tempDir, "fc25.sqlite");

  try {
    const importResult = importFc25Dataset({
      csvPath,
      databasePath,
      datasetVersionId: "fc25-real-squad-responsiveness"
    });
    const db = getDb(databasePath);
    const liverpool = loadFc25Squad("liverpool", importResult.datasetVersionId, {
      include: "all",
      db
    });
    const city = loadFc25Squad("manchester-city", importResult.datasetVersionId, {
      include: "all",
      db
    });
    const villa = loadFc25Squad("aston-villa", importResult.datasetVersionId, {
      include: "all",
      db
    });

    const rotation = rotatedLiverpoolXi(liverpool.players, BASELINE_FORMATION);
    const comparisons = [
      compareScenario({
        name: "Mentality",
        baselineLabel: "Liverpool defensive",
        variantLabel: "Liverpool attacking",
        metric: "homeShots",
        thresholdPct: 30,
        seeds,
        baseline: (seed) =>
          simulate(liverpool, city, seed, { homeTactics: { mentality: "defensive" } }),
        variant: (seed) =>
          simulate(liverpool, city, seed, { homeTactics: { mentality: "attacking" } })
      }),
      compareScenario({
        name: "Pressing",
        baselineLabel: "Liverpool low pressing",
        variantLabel: "Liverpool high pressing",
        metric: "homeFouls",
        thresholdPct: 20,
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { homeTactics: { pressing: "low" } }),
        variant: (seed) => simulate(liverpool, city, seed, { homeTactics: { pressing: "high" } })
      }),
      compareScenario({
        name: "Tempo",
        baselineLabel: "Liverpool slow tempo",
        variantLabel: "Liverpool fast tempo",
        metric: "homePossessionStreak",
        thresholdPct: 15,
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { homeTactics: { tempo: "slow" } }),
        variant: (seed) => simulate(liverpool, city, seed, { homeTactics: { tempo: "fast" } })
      }),
      compareScenario({
        name: "Manual XI rotation",
        baselineLabel: "Liverpool auto XI",
        variantLabel: "Liverpool rotated XI",
        metric: "homeGoals",
        thresholdPct: 10,
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { autoSubs: false }),
        variant: (seed) =>
          simulate(liverpool, city, seed, {
            homeStartingPlayerIds: rotation.rotatedIds,
            autoSubs: false
          })
      })
    ];

    const diagnostics = [
      diagnosticScenario({
        name: "Formation",
        baselineLabel: "Liverpool 4-4-2",
        variantLabel: "Liverpool 4-3-3",
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { homeTactics: { formation: "4-4-2" } }),
        variant: (seed) => simulate(liverpool, city, seed, { homeTactics: { formation: "4-3-3" } })
      })
    ];

    const phase5 = {
      fatigueImpact: compareScenario({
        name: "Fatigue impact",
        baselineLabel: "Fatigue disabled",
        variantLabel: "Fatigue enabled",
        metric: "lateActionSuccessRate",
        thresholdPct: 3,
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { fatigue: false, autoSubs: false }),
        variant: (seed) => simulate(liverpool, city, seed, { fatigue: true, autoSubs: false })
      }),
      subImpact: compareCompositeScenario({
        name: "Auto Subs impact",
        baselineLabel: "Auto Subs OFF",
        variantLabel: "Auto Subs ON",
        thresholdPct: 5,
        metrics: ["homeShots", "homePossession", "homeFouls"],
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { autoSubs: false }),
        variant: (seed) => simulate(liverpool, city, seed, { autoSubs: true })
      }),
      scoreStateImpact: compareScenario({
        name: "Score-state impact",
        baselineLabel: "Tied control urgency",
        variantLabel: "Liverpool trailing 0-2 urgency",
        metric: "final15AverageUrgency",
        thresholdPct: 5,
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed),
        variant: (seed) =>
          simulate(liverpool, city, seed, { lateDeficitAt75: { home: 0, away: 2 } })
      }),
      scoreStateDiagnostics: compareScoreStateDiagnostics({
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed),
        variant: (seed) =>
          simulate(liverpool, city, seed, { lateDeficitAt75: { home: 0, away: 2 } })
      })
    };

    const phase6 = {
      chanceCreationImpact: compareScenario({
        name: "Chance creation impact",
        baselineLabel: "Chance creation disabled",
        variantLabel: "Chance creation enabled",
        metric: "homeFinal15Shots",
        thresholdPct: 5,
        direction: "increase",
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed, { chanceCreation: false }),
        variant: (seed) => simulate(liverpool, city, seed, { chanceCreation: true })
      }),
      scoreStateShotImpact: compareScenario({
        name: "Score-state shot impact",
        baselineLabel: "Tied control",
        variantLabel: "Liverpool trailing 0-2 at 75'",
        metric: "homeFinal15Shots",
        thresholdPct: 15,
        direction: "increase",
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed),
        variant: (seed) =>
          simulate(liverpool, city, seed, { lateDeficitAt75: { home: 0, away: 2 } })
      }),
      setPieceImpact: setPieceDiagnostics(
        runSeeds(seeds, (seed) => simulate(liverpool, villa, seed, { setPieces: true }))
      )
    };

    const report: RealSquadResponsivenessReport = {
      generatedAt: new Date().toISOString(),
      csvPath,
      seeds,
      matchup: { home: "liverpool", away: "manchester-city" },
      rotation: {
        description:
          "Liverpool 4-3-3 auto XI with the top three highest-overall outfield starters replaced by the top three highest-overall outfield bench players.",
        removedStarterIds: rotation.removedStarterIds,
        addedBenchIds: rotation.addedBenchIds
      },
      comparisons,
      diagnostics,
      phase5,
      phase6,
      pass:
        comparisons.every((comparison) => comparison.status === "PASS") &&
        phase5.fatigueImpact.status === "PASS" &&
        phase5.subImpact.status === "PASS" &&
        phase5.scoreStateImpact.status === "PASS" &&
        phase6.scoreStateShotImpact.status === "PASS"
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function compareScoreStateDiagnostics(options: {
  seeds: number;
  baseline: (seed: number) => RunMetrics;
  variant: (seed: number) => RunMetrics;
}): { baseline: ScoreStateDiagnostics; variant: ScoreStateDiagnostics } {
  return {
    baseline: aggregateScoreStateDiagnostics(runSeeds(options.seeds, options.baseline)),
    variant: aggregateScoreStateDiagnostics(runSeeds(options.seeds, options.variant))
  };
}

function aggregateScoreStateDiagnostics(metrics: RunMetrics[]): ScoreStateDiagnostics {
  const actions: Record<string, number> = {};
  const passTypes: Record<string, number> = {};
  let urgency = 0;
  let shots = 0;
  let possessionTicks = 0;

  for (const metric of metrics) {
    urgency += metric.scoreStateDiagnostics.final15AverageUrgency;
    shots += metric.scoreStateDiagnostics.final15Shots;
    possessionTicks += metric.scoreStateDiagnostics.final15PossessionTicks;
    addCounts(actions, metric.scoreStateDiagnostics.final15Actions);
    addCounts(passTypes, metric.scoreStateDiagnostics.final15PassTypes);
  }

  return {
    final15AverageUrgency: urgency / metrics.length,
    final15Actions: actions,
    final15PassTypes: passTypes,
    final15Shots: shots / metrics.length,
    final15PossessionTicks: possessionTicks / metrics.length
  };
}

function compareScenario(options: {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  metric: MetricKey;
  thresholdPct: number;
  direction?: "absolute" | "increase";
  seeds: number;
  baseline: (seed: number) => RunMetrics;
  variant: (seed: number) => RunMetrics;
}): ComparisonResult {
  const baseline = runSeeds(options.seeds, options.baseline);
  const variant = runSeeds(options.seeds, options.variant);
  const baselineAverage = average(baseline.map((metrics) => metrics[options.metric]));
  const variantAverage = average(variant.map((metrics) => metrics[options.metric]));
  const deltaPct = percentageChange(variantAverage, baselineAverage);
  return {
    name: options.name,
    baselineLabel: options.baselineLabel,
    variantLabel: options.variantLabel,
    metric: options.metric,
    thresholdPct: options.thresholdPct,
    baselineAverage,
    variantAverage,
    deltaPct,
    status:
      options.direction === "increase"
        ? deltaPct >= options.thresholdPct
          ? "PASS"
          : "FAIL"
        : Math.abs(deltaPct) >= options.thresholdPct
          ? "PASS"
          : "FAIL"
  };
}

function compareCompositeScenario(options: {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  thresholdPct: number;
  metrics: MetricKey[];
  seeds: number;
  baseline: (seed: number) => RunMetrics;
  variant: (seed: number) => RunMetrics;
}): CompositeResult {
  const baseline = runSeeds(options.seeds, options.baseline);
  const variant = runSeeds(options.seeds, options.variant);
  const shiftedMetrics = options.metrics
    .map((metric) => {
      const baselineAverage = average(baseline.map((result) => result[metric]));
      const variantAverage = average(variant.map((result) => result[metric]));
      return {
        metric,
        baselineAverage,
        variantAverage,
        deltaPct: percentageChange(variantAverage, baselineAverage)
      };
    })
    .filter((metric) => Math.abs(metric.deltaPct) >= options.thresholdPct);

  return {
    name: options.name,
    baselineLabel: options.baselineLabel,
    variantLabel: options.variantLabel,
    thresholdPct: options.thresholdPct,
    shiftedMetrics,
    substitutionDiagnostics: buildSubstitutionDiagnostics(variant),
    status:
      shiftedMetrics.length > 0 || substitutionActivationPass(buildSubstitutionDiagnostics(variant))
        ? "PASS"
        : "FAIL"
  };
}

function substitutionActivationPass(diagnostics: SubstitutionDiagnostics): boolean {
  return (
    diagnostics.averageTotalSubs >= 1 &&
    diagnostics.averageHomeSubs >= 1 &&
    diagnostics.averageAwaySubs >= 1 &&
    diagnostics.zeroSubMatches === 0 &&
    diagnostics.maxSubsInMatch <= 10
  );
}

function buildSubstitutionDiagnostics(metrics: RunMetrics[]): SubstitutionDiagnostics {
  const substitutions = metrics.flatMap((metric) => metric.substitutionEvents);
  const minuteBuckets: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  const replacements = new Map<string, { playerOutId: string; playerInId: string; count: number }>();

  for (const substitution of substitutions) {
    const bucketStart = Math.floor(substitution.minute / 5) * 5;
    const bucket = `${bucketStart}-${bucketStart + 4}`;
    minuteBuckets[bucket] = (minuteBuckets[bucket] ?? 0) + 1;
    reasons[substitution.reason] = (reasons[substitution.reason] ?? 0) + 1;
    const key = `${substitution.playerOutId}->${substitution.playerInId}`;
    const existing = replacements.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      replacements.set(key, {
        playerOutId: substitution.playerOutId,
        playerInId: substitution.playerInId,
        count: 1
      });
    }
  }

  return {
    averageTotalSubs: average(metrics.map((metric) => metric.substitutions)),
    averageHomeSubs: average(
      metrics.map(
        (metric) => metric.substitutionEvents.filter((event) => event.teamId === "home").length
      )
    ),
    averageAwaySubs: average(
      metrics.map(
        (metric) => metric.substitutionEvents.filter((event) => event.teamId === "away").length
      )
    ),
    zeroSubMatches: metrics.filter((metric) => metric.substitutions === 0).length,
    maxSubsInMatch: Math.max(0, ...metrics.map((metric) => metric.substitutions)),
    minuteBuckets,
    reasons,
    topReplacements: [...replacements.values()]
      .sort((a, b) => b.count - a.count || a.playerOutId.localeCompare(b.playerOutId))
      .slice(0, 10)
  };
}

function setPieceDiagnostics(metrics: RunMetrics[]): SetPieceDiagnostics {
  const penalties = average(metrics.map((metric) => metric.penalties));
  const penaltyGoals = average(metrics.map((metric) => metric.penaltyGoals));
  return {
    averageSetPieceEvents: average(metrics.map((metric) => metric.setPieceEvents)),
    averageSetPieceGoals: average(metrics.map((metric) => metric.setPieceGoals)),
    averageCorners: average(metrics.map((metric) => metric.corners)),
    averageDirectFreeKicks: average(metrics.map((metric) => metric.directFreeKicks)),
    averageIndirectFreeKicks: average(metrics.map((metric) => metric.indirectFreeKicks)),
    averagePenalties: penalties,
    penaltyConversionPct: penalties === 0 ? 0 : (penaltyGoals / penalties) * 100
  };
}

function diagnosticScenario(options: {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  seeds: number;
  baseline: (seed: number) => RunMetrics;
  variant: (seed: number) => RunMetrics;
}): DiagnosticResult {
  const baseline = runSeeds(options.seeds, options.baseline);
  const variant = runSeeds(options.seeds, options.variant);
  const keys: Array<MetricKey | "homeWideDeliveries"> = [
    "homeGoals",
    "homeShots",
    "homeFouls",
    "homePossessionStreak",
    "homeWideDeliveries"
  ];
  const baselineAverages = averagesFor(baseline, keys);
  const variantAverages = averagesFor(variant, keys);
  return {
    name: options.name,
    baselineLabel: options.baselineLabel,
    variantLabel: options.variantLabel,
    baselineAverages,
    variantAverages,
    deltaPct: Object.fromEntries(
      keys.map((key) => [key, percentageChange(variantAverages[key], baselineAverages[key])])
    )
  };
}

function simulate(
  home: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] },
  away: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] },
  seed: number,
  overrides: {
    homeTactics?: Partial<TeamTactics>;
    awayTactics?: Partial<TeamTactics>;
    homeStartingPlayerIds?: string[];
    fatigue?: boolean;
    scoreState?: boolean;
    autoSubs?: boolean;
    chanceCreation?: boolean;
    setPieces?: boolean;
    preMatchScore?: { home: number; away: number };
    lateDeficitAt75?: { home: number; away: number };
  } = {}
): RunMetrics {
  const homeTactics = { ...BASELINE_TACTICS, ...overrides.homeTactics };
  const awayTactics = { ...BASELINE_TACTICS, ...overrides.awayTactics };
  const config: MatchConfigV2 = {
    seed,
    duration: "full_90",
    homeTeam: buildTeam(home, homeTactics, overrides.homeStartingPlayerIds),
    awayTeam: buildTeam(away, awayTactics),
    dynamics: {
      fatigue: overrides.fatigue ?? true,
      scoreState: overrides.scoreState ?? true,
      autoSubs: overrides.autoSubs ?? true,
      chanceCreation: overrides.chanceCreation ?? true,
      setPieces: overrides.setPieces ?? true
    },
    ...(overrides.preMatchScore ? { preMatchScore: overrides.preMatchScore } : {})
  };
  const snapshot = overrides.lateDeficitAt75
    ? simulateWithLateDeficit(config, overrides.lateDeficitAt75)
    : simulateMatch(config);
  return metricsFor(seed, snapshot);
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

function buildTeam(
  squad: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] },
  tactics: TeamTactics,
  startingPlayerIds?: string[]
): TeamV2 {
  const lineup = selectLineup(
    squad.players,
    tactics.formation as SupportedFormation,
    startingPlayerIds
  );
  return {
    id: squad.clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: lineup.xi,
    bench: lineup.bench,
    tactics
  };
}

export function rotatedLiverpoolXi(
  squad: readonly Fc25SquadPlayer[],
  formation: SupportedFormation
): { rotatedIds: string[]; removedStarterIds: string[]; addedBenchIds: string[] } {
  const lineup = selectLineup(squad, formation);
  const startersToRemove = lineup.xi
    .filter((player) => player.sourcePosition !== "GK")
    .sort(comparePlayers)
    .slice(0, 3);
  const benchToAdd = lineup.bench
    .filter((player) => player.sourcePosition !== "GK")
    .sort(comparePlayers)
    .slice(0, 3);
  const removedStarterIds = startersToRemove.map((player) => player.id);
  const addedBenchIds = benchToAdd.map((player) => player.id);
  return {
    rotatedIds: [
      ...lineup.xi
        .filter((player) => !removedStarterIds.includes(player.id))
        .map((player) => player.id),
      ...addedBenchIds
    ],
    removedStarterIds,
    addedBenchIds
  };
}

function metricsFor(seed: number, snapshot: MatchSnapshot): RunMetrics {
  const { home, away } = snapshot.finalSummary.statistics;
  const setPieces = snapshot.finalSummary.setPieces;
  const setPieceGoals = countSetPieceGoals(snapshot);
  return {
    seed,
    homeGoals: snapshot.finalSummary.finalScore.home,
    awayGoals: snapshot.finalSummary.finalScore.away,
    homeShots: home.shots.total,
    awayShots: away.shots.total,
    homeFouls: home.fouls,
    awayFouls: away.fouls,
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
    final15AverageUrgency: scoreStateDiagnostics(snapshot).final15AverageUrgency,
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
    penaltyGoals: setPieceGoals.penalty,
    scoreStateDiagnostics: scoreStateDiagnostics(snapshot),
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

function scoreStateDiagnostics(snapshot: MatchSnapshot): ScoreStateDiagnostics {
  const actions: Record<string, number> = {};
  const passTypes: Record<string, number> = {};
  let urgencyTotal = 0;
  let urgencySamples = 0;
  let possessionTicks = 0;

  for (const tick of snapshot.ticks) {
    if (tick.matchClock.minute < 75) {
      continue;
    }
    urgencyTotal += urgencyForHome(tick.matchClock.minute, tick.score.home, tick.score.away);
    urgencySamples += 1;
    if (tick.possession.teamId === "home") {
      possessionTicks += 1;
    }
    for (const event of tick.events) {
      if (event.team !== "home") {
        continue;
      }
      actions[event.type] = (actions[event.type] ?? 0) + 1;
      if (event.type === "pass") {
        const passType =
          typeof event.detail?.passType === "string" ? event.detail.passType : "unknown";
        passTypes[passType] = (passTypes[passType] ?? 0) + 1;
      }
    }
  }

  return {
    final15AverageUrgency: urgencySamples === 0 ? 0 : urgencyTotal / urgencySamples,
    final15Actions: actions,
    final15PassTypes: passTypes,
    final15Shots: actions.shot ?? 0,
    final15PossessionTicks: possessionTicks
  };
}

function countSetPieceGoals(snapshot: MatchSnapshot): { penalty: number } {
  let penalty = 0;
  for (const event of snapshot.ticks.flatMap((tick) => tick.events)) {
    if (event.type !== "goal_scored") {
      continue;
    }
    const context = event.detail?.setPieceContext;
    if (!context || typeof context !== "object" || Array.isArray(context)) {
      continue;
    }
    if ((context as { type?: unknown }).type === "penalty") {
      penalty += 1;
    }
  }
  return { penalty };
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

function addCounts(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function lateActionSuccessRate(snapshot: MatchSnapshot): number {
  const attempts = snapshot.ticks
    .flatMap((tick) => tick.events)
    .filter(
      (event) =>
        event.minute >= 75 && ["pass", "carry", "shot", "save"].includes(event.type)
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

function runSeeds(seeds: number, runner: (seed: number) => RunMetrics): RunMetrics[] {
  return Array.from({ length: seeds }, (_, index) => runner(index + 1));
}

function averagesFor<T extends NumericMetricKey>(
  metrics: RunMetrics[],
  keys: readonly T[]
): Record<T, number> {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      average(metrics.map((metric) => metric[key]))
    ])
  ) as Record<T, number>;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentageChange(next: number, previous: number): number {
  return previous === 0 ? 0 : ((next - previous) / previous) * 100;
}

function comparePlayers(a: Fc25SquadPlayer, b: Fc25SquadPlayer): number {
  return b.overall - a.overall || a.id.localeCompare(b.id);
}
