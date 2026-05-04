import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  simulateMatch,
  type MatchConfigV2,
  type MatchDuration,
  type MatchSnapshot,
  type SemanticEvent,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";

import { getDb, type SqliteDatabase } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25DatasetVersion, Fc25SquadPlayer } from "../types";
import { getActiveFc25DatasetVersion, listFc25Clubs, loadFc25Squad } from "./importer";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/phase13-event-volume-diagnostics.json";
const EXPECTED_SOURCE_FILE = "FC26_20250921.csv";
const CLUBS = [
  "arsenal",
  "aston-villa",
  "liverpool",
  "manchester-city",
  "manchester-united"
] as const satisfies readonly Fc25ClubId[];
type Phase13ClubId = (typeof CLUBS)[number];
const EXPECTED_COUNTS: Record<Phase13ClubId, number> = {
  arsenal: 24,
  "aston-villa": 24,
  liverpool: 28,
  "manchester-city": 26,
  "manchester-united": 26
};
const BASELINE_FORMATION: SupportedFormation = "4-3-3";
const BASELINE_TACTICS: TeamTactics = {
  formation: BASELINE_FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

export interface Phase13EventVolumeOptions {
  outputPath?: string;
  seedsPerFixture?: number;
  sanitySeeds?: number;
  databasePath?: string;
  gitSha?: string;
}

export interface Phase13EventVolumeReport {
  schemaVersion: 1;
  generatedAt: string;
  gitSha: string;
  dataset: {
    id: string;
    name: string;
    sourceFile: string;
    sourceFileSha256: string;
    createdAt: string;
    squadCounts: Record<Phase13ClubId, number>;
  };
  methodology: {
    fixtures: Phase13Fixture[];
    seedsPerFixture: number;
    note: string;
    nonObservableInternals: string[];
  };
  definitionAudit: DefinitionAuditRow[];
  sanity: {
    seeds: number;
    pass: boolean;
    activePlayersPerClub: Record<Phase13ClubId, number>;
    lineupWarnings: string[];
  };
  fixtures: Phase13FixtureSummary[];
  aggregate: Phase13AggregateSummary;
  mechanismCandidates: MechanismCandidate[];
  synthesis: {
    upstreamShotFinding: string;
    foulFinding: string;
    cornerFinding: string;
    phase14PriorityOrder: string[];
    recommendation: string;
  };
}

export interface Phase13Fixture {
  home: Phase13ClubId;
  away: Phase13ClubId;
  reason: string;
}

export interface DefinitionAuditRow {
  metric: "shots" | "goals" | "fouls" | "cards" | "corners";
  realPlDefinition: string;
  footSimDefinition: string;
  equivalence: "equivalent" | "minor-caveat" | "definition-gap";
  estimatedCorrection: string;
}

export interface Phase13FixtureSummary {
  home: Phase13ClubId;
  away: Phase13ClubId;
  seeds: number;
  averages: EventVolumeMetrics;
  standardErrors: EventVolumeMetrics;
}

export interface Phase13AggregateSummary {
  seeds: number;
  fixtureCount: number;
  averages: EventVolumeMetrics;
  standardErrors: EventVolumeMetrics;
  ratios: DiagnosticRatios;
}

export interface EventVolumeMetrics {
  shots: number;
  goals: number;
  shotConversionPct: number;
  onTargetShots: number;
  offTargetShots: number;
  blockedShots: number;
  chanceCreated: number;
  chanceConvertedToShot: number;
  chanceConversionPct: number;
  chanceShots: number;
  setPieceShots: number;
  openPlayCarrierShots: number;
  passes: number;
  progressivePasses: number;
  keyPasses: number;
  crosses: number;
  cutbacks: number;
  fouls: number;
  freeKicksAwarded: number;
  penaltiesAwarded: number;
  successfulTackles: number;
  observableTackleResolutions: number;
  foulShareOfObservableTackleResolutionsPct: number;
  cards: number;
  corners: number;
  cornersFromDeflectedShots: number;
  cornersFromDefensiveClearances: number;
  cornerTaken: number;
  cornerShots: number;
  cornerShotConversionPct: number;
  setPieceGoals: number;
  throwIns: number;
  goalKicks: number;
}

export interface DiagnosticRatios {
  chanceShotsSharePct: number;
  setPieceShotsSharePct: number;
  openPlayCarrierShotsSharePct: number;
  cornersPerShotPct: number;
  cornersFromDeflectedShotsPerShotPct: number;
  foulsPerObservableTackleResolutionPct: number;
  cardsPerFoulPct: number;
}

export interface MechanismCandidate {
  priority: number;
  codePath: string;
  constants: string[];
  currentValues: string;
  controls: string;
  expectedSensitivity: "high" | "medium" | "low" | "unknown";
  diagnosticSignal: string;
  phase14ExpectedEffect: string;
  risks: string[];
}

interface Context {
  version: Fc25DatasetVersion;
  squadCounts: Record<Phase13ClubId, number>;
  squads: Record<Phase13ClubId, LoadedSquad>;
}

interface LoadedSquad {
  clubId: Phase13ClubId;
  clubName: string;
  shortName: string;
  players: Fc25SquadPlayer[];
}

interface RunDiagnostics extends EventVolumeMetrics {
  seed: number;
}

export function runPhase13EventVolumeDiagnostics(
  options: Phase13EventVolumeOptions = {}
): Phase13EventVolumeReport {
  const db = getDb(options.databasePath);
  const context = buildContext(db);
  const sanitySeeds = options.sanitySeeds ?? 10;
  const seedsPerFixture = options.seedsPerFixture ?? 100;
  const fixtures = phase13Fixtures();
  const sanity = runSanity(context, sanitySeeds);
  if (!sanity.pass) {
    throw new Error("Phase 13 event-volume sanity check failed");
  }
  const runsByFixture = fixtures.map((fixture) => ({
    fixture,
    runs: runSeeds(seedsPerFixture, (seed) => analyseFixtureSeed(context, fixture, seed))
  }));
  const fixtureSummaries = runsByFixture.map(({ fixture, runs }) => summariseFixture(fixture, runs));
  const allRuns = runsByFixture.flatMap(({ runs }) => runs);
  const aggregate = aggregateSummary(allRuns, fixtureSummaries.length);
  const report: Phase13EventVolumeReport = {
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
    methodology: {
      fixtures,
      seedsPerFixture,
      note:
        "Snapshot-only diagnostic harness. It measures emitted event supply and labels pre-roll tackle/corner internals as non-observable without engine-source instrumentation.",
      nonObservableInternals: [
        "raw tackle attempts that miss or do not emit a foul/possession-change event",
        "corner-eligible defensive clearances that fail the corner-award roll",
        "deflected-shot corner rolls that fail and become goal kicks",
        "carrier action choices that resolve as hold or unremarkable short circulation"
      ]
    },
    definitionAudit: definitionAudit(),
    sanity,
    fixtures: fixtureSummaries,
    aggregate,
    mechanismCandidates: mechanismCandidates(aggregate),
    synthesis: synthesisFor(aggregate)
  };

  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function phase13Fixtures(): Phase13Fixture[] {
  return [
    {
      home: "liverpool",
      away: "manchester-city",
      reason: "Phase 11/12 anchor and top-defensive matchup"
    },
    {
      home: "manchester-united",
      away: "liverpool",
      reason: "High-goal Phase 12 profile"
    },
    {
      home: "manchester-city",
      away: "manchester-united",
      reason: "Low-shot Phase 12 profile"
    },
    {
      home: "arsenal",
      away: "aston-villa",
      reason: "Mid-matrix profile outside the Liverpool/City axis"
    },
    {
      home: "aston-villa",
      away: "manchester-city",
      reason: "Low-goal Phase 12 profile with City away"
    }
  ];
}

export function definitionAudit(): DefinitionAuditRow[] {
  return [
    {
      metric: "shots",
      realPlDefinition:
        "Football-Data.co.uk HS/AS are home/away team shots; the notes also publish HST/AST shots-on-target columns separately.",
      footSimDefinition:
        "FootSim increments total shots before shot resolution, so on-target, off-target, blocked attempts and penalties are included.",
      equivalence: "equivalent",
      estimatedCorrection:
        "No material correction. FootSim's shot total already includes the main categories implied by the Football-Data.co.uk shots column."
    },
    {
      metric: "goals",
      realPlDefinition: "Football-Data.co.uk FTHG/FTAG are full-time home/away goals.",
      footSimDefinition: "FootSim final score increments on goal_scored events.",
      equivalence: "equivalent",
      estimatedCorrection: "No correction."
    },
    {
      metric: "fouls",
      realPlDefinition: "Football-Data.co.uk HF/AF are fouls committed.",
      footSimDefinition:
        "FootSim increments fouls when tackle resolution commits a referee-awarded foul and then awards a restart if set pieces are enabled.",
      equivalence: "equivalent",
      estimatedCorrection:
        "No material correction. Both measures are awarded/committed fouls, not all challenge attempts."
    },
    {
      metric: "cards",
      realPlDefinition:
        "Football-Data.co.uk HY/AY/HR/AR are issued cards; English yellow-card notes exclude the initial yellow when a second yellow becomes red.",
      footSimDefinition:
        "FootSim emits yellow and red from foul severity rolls and reports yellow plus red totals.",
      equivalence: "minor-caveat",
      estimatedCorrection:
        "Small caveat only. The Football-Data.co.uk second-yellow convention would lower the real card count slightly, so it does not explain FootSim's lower card volume."
    },
    {
      metric: "corners",
      realPlDefinition: "Football-Data.co.uk HC/AC are home/away team corners.",
      footSimDefinition:
        "FootSim increments corners only when a corner restart is awarded from deflected shots or defensive clearances.",
      equivalence: "equivalent",
      estimatedCorrection:
        "No definitional correction, but FootSim has fewer corner-generation pathways than real football."
    }
  ];
}

export function analyseSnapshot(snapshot: MatchSnapshot, seed = 0): RunDiagnostics {
  const events = snapshot.ticks.flatMap((tick) => tick.events);
  return analyseEvents(events, snapshot, seed);
}

export function analyseEvents(
  events: SemanticEvent[],
  snapshot: MatchSnapshot,
  seed = 0
): RunDiagnostics {
  const home = snapshot.finalSummary.statistics.home;
  const away = snapshot.finalSummary.statistics.away;
  const setPieces = snapshot.finalSummary.setPieces;
  const shots = home.shots.total + away.shots.total;
  const goals = snapshot.finalSummary.finalScore.home + snapshot.finalSummary.finalScore.away;
  const fouls = home.fouls + away.fouls;
  const cards = home.yellowCards + away.yellowCards + home.redCards + away.redCards;
  const chanceEvents = events.filter((event) => event.type === "chance_created");
  const shotEvents = events.filter((event) => event.type === "shot");
  const passEvents = events.filter((event) => event.type === "pass");
  const cornerEvents = events.filter((event) => event.type === "corner");
  const cornerTakenEvents = events.filter((event) => event.type === "corner_taken");
  const freeKickEvents = events.filter((event) => event.type === "free_kick");
  const penaltyTakenEvents = events.filter((event) => event.type === "penalty_taken");
  const successfulTackles = events.filter(
    (event) =>
      event.type === "possession_change" && stringDetail(event, "cause") === "successful_tackle"
  ).length;
  const chanceConvertedToShot = chanceEvents.filter(
    (event) => booleanDetail(event, "convertedToShot")
  ).length;
  const chanceShots = shotEvents.filter((event) => stringDetail(event, "chanceSource") !== null).length;
  const setPieceShots = shotEvents.filter((event) => detailObject(event, "setPieceContext") !== null).length;
  const cornerShots = shotEvents.filter((event) => setPieceType(event) === "corner").length;
  const cornersFromDeflectedShots = cornerEvents.filter(
    (event) => stringDetail(event, "reason") === "deflected_shot"
  ).length;
  const cornersFromDefensiveClearances = cornerEvents.filter(
    (event) => stringDetail(event, "reason") === "defensive_clearance"
  ).length;
  const openPlayCarrierShots = Math.max(0, shots - chanceShots - setPieceShots);
  const observableTackleResolutions = fouls + successfulTackles;
  const chanceConversionPct = pct(chanceConvertedToShot, chanceEvents.length);
  const cornerShotConversionPct = pct(cornerShots, cornerTakenEvents.length);
  const shotConversionPct = pct(goals, shots);
  const foulShareOfObservableTackleResolutionsPct = pct(fouls, observableTackleResolutions);
  return {
    seed,
    shots,
    goals,
    shotConversionPct,
    onTargetShots: home.shots.on + away.shots.on,
    offTargetShots: home.shots.off + away.shots.off,
    blockedShots: home.shots.blocked + away.shots.blocked,
    chanceCreated: chanceEvents.length,
    chanceConvertedToShot,
    chanceConversionPct,
    chanceShots,
    setPieceShots,
    openPlayCarrierShots,
    passes: passEvents.length,
    progressivePasses: passEvents.filter((event) => booleanDetail(event, "progressive")).length,
    keyPasses: passEvents.filter((event) => booleanDetail(event, "keyPass")).length,
    crosses: passEvents.filter((event) => stringDetail(event, "passType") === "cross").length,
    cutbacks: passEvents.filter((event) => stringDetail(event, "passType") === "cutback").length,
    fouls,
    freeKicksAwarded: freeKickEvents.length,
    penaltiesAwarded: penaltyTakenEvents.length,
    successfulTackles,
    observableTackleResolutions,
    foulShareOfObservableTackleResolutionsPct,
    cards,
    corners: (setPieces?.home.corners ?? 0) + (setPieces?.away.corners ?? 0),
    cornersFromDeflectedShots,
    cornersFromDefensiveClearances,
    cornerTaken: cornerTakenEvents.length,
    cornerShots,
    cornerShotConversionPct,
    setPieceGoals: (setPieces?.home.setPieceGoals ?? 0) + (setPieces?.away.setPieceGoals ?? 0),
    throwIns: events.filter((event) => event.type === "throw_in").length,
    goalKicks: events.filter((event) => event.type === "goal_kick").length
  };
}

export function summariseRuns(runs: RunDiagnostics[]): {
  averages: EventVolumeMetrics;
  standardErrors: EventVolumeMetrics;
} {
  return {
    averages: metricsFrom(runs, average),
    standardErrors: metricsFrom(runs, standardError)
  };
}

export function diagnosticRatios(metrics: EventVolumeMetrics): DiagnosticRatios {
  return {
    chanceShotsSharePct: pct(metrics.chanceShots, metrics.shots),
    setPieceShotsSharePct: pct(metrics.setPieceShots, metrics.shots),
    openPlayCarrierShotsSharePct: pct(metrics.openPlayCarrierShots, metrics.shots),
    cornersPerShotPct: pct(metrics.corners, metrics.shots),
    cornersFromDeflectedShotsPerShotPct: pct(metrics.cornersFromDeflectedShots, metrics.shots),
    foulsPerObservableTackleResolutionPct: metrics.foulShareOfObservableTackleResolutionsPct,
    cardsPerFoulPct: pct(metrics.cards, metrics.fouls)
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
  const clubs = listFc25Clubs(version.id, db);
  const squadCounts = Object.fromEntries(
    CLUBS.map((clubId) => [
      clubId,
      clubs.some((club) => club.id === clubId)
        ? db
            .prepare<[string, string], { count: number }>(
              "SELECT COUNT(*) AS count FROM fc25_squads WHERE dataset_version_id = ? AND club_id = ?"
            )
            .get(version.id, clubId)?.count ?? 0
        : 0
    ])
  ) as Record<Phase13ClubId, number>;
  for (const [clubId, expected] of Object.entries(EXPECTED_COUNTS) as Array<[Phase13ClubId, number]>) {
    if (squadCounts[clubId] !== expected) {
      throw new Error(
        `Expected ${expected} FC26 squad rows for ${clubId}, found ${squadCounts[clubId] ?? 0}`
      );
    }
  }
  return {
    version,
    squadCounts,
    squads: Object.fromEntries(CLUBS.map((clubId) => [clubId, loadSquad(clubId, version.id, db)])) as Record<
      Phase13ClubId,
      LoadedSquad
    >
  };
}

function loadSquad(clubId: Phase13ClubId, versionId: string, db: SqliteDatabase): LoadedSquad {
  return { ...loadFc25Squad(clubId, versionId, { include: "all", db }), clubId };
}

function runSanity(
  context: Context,
  seeds: number
): Phase13EventVolumeReport["sanity"] {
  const lineupWarnings: string[] = [];
  const activePlayersPerClub = {} as Record<Phase13ClubId, number>;
  for (const clubId of CLUBS) {
    const lineup = selectLineup(context.squads[clubId].players, BASELINE_FORMATION);
    activePlayersPerClub[clubId] = lineup.xi.length;
    lineupWarnings.push(
      ...lineup.warnings.map((warning) => `${clubId}:${warning.code}:${warning.playerId}`)
    );
  }
  runSeeds(seeds, (seed) =>
    analyseFixtureSeed(context, { home: "liverpool", away: "manchester-city" }, seed)
  );
  return {
    seeds,
    pass:
      Object.values(activePlayersPerClub).every((count) => count === 11) &&
      lineupWarnings.length === 0,
    activePlayersPerClub,
    lineupWarnings
  };
}

function analyseFixtureSeed(
  context: Context,
  fixture: Pick<Phase13Fixture, "home" | "away">,
  seed: number,
  duration: MatchDuration = "full_90"
): RunDiagnostics {
  const config: MatchConfigV2 = {
    seed,
    duration,
    homeTeam: buildTeam(context.squads[fixture.home]),
    awayTeam: buildTeam(context.squads[fixture.away]),
    dynamics: {
      fatigue: true,
      scoreState: true,
      autoSubs: true,
      chanceCreation: true,
      setPieces: true,
      sideSwitch: true
    }
  };
  return analyseSnapshot(simulateMatch(config), seed);
}

function buildTeam(squad: LoadedSquad): TeamV2 {
  const lineup = selectLineup(squad.players, BASELINE_FORMATION);
  return {
    id: squad.clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: lineup.xi,
    bench: lineup.bench,
    tactics: BASELINE_TACTICS
  };
}

function summariseFixture(
  fixture: Phase13Fixture,
  runs: RunDiagnostics[]
): Phase13FixtureSummary {
  const summary = summariseRuns(runs);
  return {
    home: fixture.home,
    away: fixture.away,
    seeds: runs.length,
    averages: summary.averages,
    standardErrors: summary.standardErrors
  };
}

function aggregateSummary(runs: RunDiagnostics[], fixtureCount: number): Phase13AggregateSummary {
  const summary = summariseRuns(runs);
  return {
    seeds: runs.length,
    fixtureCount,
    averages: summary.averages,
    standardErrors: summary.standardErrors,
    ratios: diagnosticRatios(summary.averages)
  };
}

function mechanismCandidates(aggregate: Phase13AggregateSummary): MechanismCandidate[] {
  return [
    {
      priority: 1,
      codePath: "packages/match-engine/src/resolution/carrierAction.ts",
      constants: ["ACTION_WEIGHTS.att.*.shoot", "SUCCESS_PROBABILITIES.shotDistance.*.actionWeight"],
      currentValues:
        "Attacking-zone shoot weights: low 0.18, medium 0.26, high 0.38; speculative actionWeight 0.12.",
      controls: "Baseline carrier decision to shoot before shot-resolution quality is applied.",
      expectedSensitivity: "high",
      diagnosticSignal: `${aggregate.averages.openPlayCarrierShots.toFixed(2)} open-play carrier shots/match, ${aggregate.ratios.openPlayCarrierShotsSharePct.toFixed(1)}% of shots.`,
      phase14ExpectedEffect:
        "Raising these values should lift shot volume directly, but goals will rise unless shot quality/save tuning absorbs the extra attempts.",
      risks: [
        "Goals are already near the real-PL band, so shot-volume tuning can overheat goals.",
        "Mentality, tempo and score-state responsiveness multiply this path.",
        "Wide-delivery behaviour may dilute if central carriers shoot too often."
      ]
    },
    {
      priority: 2,
      codePath: "packages/match-engine/src/resolution/chanceCreation.ts",
      constants: ["CHANCE_CREATION.sourceBase", "CHANCE_CREATION.pressure", "CHANCE_CREATION.distanceBand"],
      currentValues:
        "Source bases 0.055-0.12; medium pressure 0.58; high pressure 0; far/speculative chance conversion 0.",
      controls: "Secondary shot supply from progressive passes, crosses, cutbacks and carries.",
      expectedSensitivity: "medium",
      diagnosticSignal: `${aggregate.averages.chanceCreated.toFixed(2)} chances/match and ${aggregate.averages.chanceConversionPct.toFixed(1)}% chance-to-shot conversion.`,
      phase14ExpectedEffect:
        "Raising source bases or softening the high-pressure gate should increase chance-created shots and late-match shot texture.",
      risks: [
        "Chance creation composes with score-state urgency.",
        "Cross/cutback boosts can also raise corner and set-piece goal volume indirectly.",
        "A broad boost may make elite FC26 attacks too efficient."
      ]
    },
    {
      priority: 3,
      codePath: "packages/match-engine/src/resolution/pressure.ts and actions/tackle.ts",
      constants: [
        "SUCCESS_PROBABILITIES.tackleAttemptByPressure",
        "SUCCESS_PROBABILITIES.foulOnTackleByPressure"
      ],
      currentValues: "Tackle attempts low/medium/high = 0.01/0.02/0.034; foul-on-tackle = 0.13/0.16/0.21.",
      controls: "Whether pressure becomes an emitted tackle outcome, then whether that outcome is a foul.",
      expectedSensitivity: "high",
      diagnosticSignal: `${aggregate.averages.fouls.toFixed(2)} fouls/match and ${aggregate.averages.successfulTackles.toFixed(2)} emitted successful tackles/match.`,
      phase14ExpectedEffect:
        "Increasing tackle attempts should lift fouls and turnovers together; increasing foul probability lifts fouls/cards with less turnover impact.",
      risks: [
        "Pressing responsiveness is already healthy and multiplies tackle attempts.",
        "More successful tackles changes possession and may suppress attacks unless balanced.",
        "Cards should be retested downstream rather than tuned first."
      ]
    },
    {
      priority: 4,
      codePath: "packages/match-engine/src/resolution/actions/shot.ts and actions/clearance.ts",
      constants: [
        "SET_PIECES.shotDeflectionCornerByPressure",
        "SUCCESS_PROBABILITIES.clearanceOutOfPlay",
        "SET_PIECES.defensiveClearanceCorner"
      ],
      currentValues:
        "Deflected-shot corner low/medium/high = 0.025/0.045/0.07; clearanceOutOfPlay 0.14; defensiveClearanceCorner 0.46.",
      controls: "Existing corner generation from missed/blocked shots and defensive clearances.",
      expectedSensitivity: "medium",
      diagnosticSignal: `${aggregate.averages.corners.toFixed(2)} corners/match, ${aggregate.ratios.cornersPerShotPct.toFixed(1)} corners per 100 shots.`,
      phase14ExpectedEffect:
        "Raising corner-award probabilities lifts corners, but shot-volume tuning may also lift corners organically.",
      risks: [
        "Tuning corners alone can detach corners from shot pressure.",
        "Corner shots and set-piece goals rise downstream.",
        "Real football has more corner paths than the current event vocabulary."
      ]
    },
    {
      priority: 5,
      codePath: "packages/match-engine/src/resolution/actions/tackle.ts",
      constants: ["SUCCESS_PROBABILITIES.yellowOnFoul", "SUCCESS_PROBABILITIES.redOnFoul"],
      currentValues: "yellowOnFoul 0.25; redOnFoul 0.012.",
      controls: "Cards given an already committed foul.",
      expectedSensitivity: "low",
      diagnosticSignal: `${aggregate.ratios.cardsPerFoulPct.toFixed(1)} cards per 100 fouls.`,
      phase14ExpectedEffect:
        "Treat as downstream. If fouls are tuned first, card volume may move into range without direct card tuning.",
      risks: [
        "Direct card tuning before foul tuning can mask the true foul-volume issue.",
        "Red-card frequency is sparse and high variance."
      ]
    }
  ];
}

function synthesisFor(aggregate: Phase13AggregateSummary): Phase13EventVolumeReport["synthesis"] {
  const chanceShare = aggregate.ratios.chanceShotsSharePct;
  const openPlayShare = aggregate.ratios.openPlayCarrierShotsSharePct;
  const cornerPerShot = aggregate.ratios.cornersPerShotPct;
  return {
    upstreamShotFinding:
      chanceShare >= 35
        ? "Chance creation is a meaningful shot source; Phase 14 should avoid tuning only carrier-action shooting."
        : "Most shots come from carrier-action selection, so the primary shot-volume lever is likely baseline shoot intent rather than chance conversion alone.",
    foulFinding:
      "Snapshot evidence can count emitted fouls and successful tackles, but raw tackle attempts are not emitted. Phase 14 should start from tackle-attempt and foul-given-tackle constants with paired validation.",
    cornerFinding:
      cornerPerShot >= 15
        ? "Corners per shot are plausible; low corner volume is probably mostly inherited from low shot volume."
        : "Corners are low even relative to shot volume; corner-award probabilities and missing generation paths deserve direct attention.",
    phase14PriorityOrder: [
      "Raise baseline shot supply carefully, with goals protected by paired validation.",
      "Tune tackle-attempt/foul probabilities to close foul volume before touching cards.",
      "Retest corners after shot-volume movement, then tune corner-award paths if still low.",
      "Use chance-creation pressure/source changes as a secondary shot-texture lever."
    ],
    recommendation:
      openPlayShare >= chanceShare
        ? "Scope Phase 14 around carrier-action shot supply plus foul genesis first; chance creation and corners should be secondary paired checks."
        : "Scope Phase 14 around chance-creation supply plus foul genesis first; carrier-action shooting remains a guardrail."
  };
}

function metricsFrom(
  runs: RunDiagnostics[],
  summariser: (values: number[]) => number
): EventVolumeMetrics {
  return {
    shots: summariser(runs.map((run) => run.shots)),
    goals: summariser(runs.map((run) => run.goals)),
    shotConversionPct: summariser(runs.map((run) => run.shotConversionPct)),
    onTargetShots: summariser(runs.map((run) => run.onTargetShots)),
    offTargetShots: summariser(runs.map((run) => run.offTargetShots)),
    blockedShots: summariser(runs.map((run) => run.blockedShots)),
    chanceCreated: summariser(runs.map((run) => run.chanceCreated)),
    chanceConvertedToShot: summariser(runs.map((run) => run.chanceConvertedToShot)),
    chanceConversionPct: summariser(runs.map((run) => run.chanceConversionPct)),
    chanceShots: summariser(runs.map((run) => run.chanceShots)),
    setPieceShots: summariser(runs.map((run) => run.setPieceShots)),
    openPlayCarrierShots: summariser(runs.map((run) => run.openPlayCarrierShots)),
    passes: summariser(runs.map((run) => run.passes)),
    progressivePasses: summariser(runs.map((run) => run.progressivePasses)),
    keyPasses: summariser(runs.map((run) => run.keyPasses)),
    crosses: summariser(runs.map((run) => run.crosses)),
    cutbacks: summariser(runs.map((run) => run.cutbacks)),
    fouls: summariser(runs.map((run) => run.fouls)),
    freeKicksAwarded: summariser(runs.map((run) => run.freeKicksAwarded)),
    penaltiesAwarded: summariser(runs.map((run) => run.penaltiesAwarded)),
    successfulTackles: summariser(runs.map((run) => run.successfulTackles)),
    observableTackleResolutions: summariser(runs.map((run) => run.observableTackleResolutions)),
    foulShareOfObservableTackleResolutionsPct: summariser(
      runs.map((run) => run.foulShareOfObservableTackleResolutionsPct)
    ),
    cards: summariser(runs.map((run) => run.cards)),
    corners: summariser(runs.map((run) => run.corners)),
    cornersFromDeflectedShots: summariser(runs.map((run) => run.cornersFromDeflectedShots)),
    cornersFromDefensiveClearances: summariser(
      runs.map((run) => run.cornersFromDefensiveClearances)
    ),
    cornerTaken: summariser(runs.map((run) => run.cornerTaken)),
    cornerShots: summariser(runs.map((run) => run.cornerShots)),
    cornerShotConversionPct: summariser(runs.map((run) => run.cornerShotConversionPct)),
    setPieceGoals: summariser(runs.map((run) => run.setPieceGoals)),
    throwIns: summariser(runs.map((run) => run.throwIns)),
    goalKicks: summariser(runs.map((run) => run.goalKicks))
  };
}

function stringDetail(event: SemanticEvent, key: string): string | null {
  const value = event.detail?.[key];
  return typeof value === "string" ? value : null;
}

function booleanDetail(event: SemanticEvent, key: string): boolean {
  return event.detail?.[key] === true;
}

function detailObject(event: SemanticEvent, key: string): Record<string, unknown> | null {
  const value = event.detail?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function setPieceType(event: SemanticEvent): string | null {
  const context = detailObject(event, "setPieceContext");
  const type = context?.type;
  return typeof type === "string" ? type : null;
}

function runSeeds<T>(seeds: number, runner: (seed: number) => T): T[] {
  return Array.from({ length: seeds }, (_, index) => runner(index + 1));
}

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardError(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  return Math.sqrt(sampleVariance(values) / values.length);
}

function sampleVariance(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }
  const mean = average(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}
