import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  simulateMatch,
  type MatchConfigV2,
  type MatchSnapshot,
  type SemanticEvent,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";

import { getDb, type SqliteDatabase } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25Club, Fc25ClubId, Fc25DatasetVersion, Fc25SquadPlayer } from "../types";
import { getActiveFc25DatasetVersion, listFc25Clubs, loadFc25Squad } from "./importer";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/calibration-pl20-fc26.json";
const EXPECTED_SOURCE_FILE = "FC26_20250921.csv";
const EXPECTED_CLUB_COUNT = 20;
const DEFAULT_SEEDS_PER_FIXTURE = 25;
const BASELINE_FORMATION: SupportedFormation = "4-3-3";
const BASELINE_TACTICS: TeamTactics = {
  formation: BASELINE_FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

export interface Fc26Pl20BaselineOptions {
  outputPath?: string;
  seedsPerFixture?: number;
  fixtureLimit?: number;
  sanitySeeds?: number;
  databasePath?: string;
  gitSha?: string;
}

export interface Fc26Pl20BaselineReport {
  schemaVersion: 1;
  generatedAt: string;
  gitSha: string;
  dataset: {
    id: string;
    name: string;
    sourceFile: string;
    sourceFileSha256: string;
    createdAt: string;
    clubCount: number;
    squadCounts: Record<string, number>;
  };
  methodology: {
    clubUniverse: "english-premier-league-20";
    fixtureShape: string;
    seedsPerFixture: number;
    fixtureLimit: number | null;
    tactics: TeamTactics;
  };
  sanity: {
    seeds: number;
    pass: boolean;
    activePlayersPerClub: Record<string, number>;
    lineupWarnings: string[];
  };
  fixtureMatrix: Array<{ home: Fc25ClubId; away: Fc25ClubId; seeds: number }>;
  fixtures: Pl20FixtureSummary[];
  aggregate: Pl20AggregateSummary;
  shotComposition: ShotCompositionMetrics;
  homeAwayEffect: {
    goals: { meanHomeMinusAway: number; standardError: number };
    shots: { meanHomeMinusAway: number; standardError: number };
  };
  synthesis: {
    fixturesRun: number;
    totalRuns: number;
    recommendation: string;
  };
}

export interface Pl20FixtureSummary {
  home: Fc25ClubId;
  away: Fc25ClubId;
  seeds: number;
  metrics: Pl20FixtureMetrics;
  standardErrors: Pl20FixtureMetrics;
}

export interface Pl20FixtureMetrics {
  homeShots: number;
  awayShots: number;
  totalShots: number;
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  homeFouls: number;
  awayFouls: number;
  totalFouls: number;
  homeCards: number;
  awayCards: number;
  totalCards: number;
  homePossession: number;
  awayPossession: number;
  corners: number;
  directFreeKicks: number;
  indirectFreeKicks: number;
  penalties: number;
  setPieceGoals: number;
  saves: number;
  cornersFromDeflectedShots: number;
  cornersFromDefensiveClearances: number;
  cornersFromSavedWide: number;
  cornersFromBlockedDelivery: number;
}

export interface Pl20AggregateSummary {
  seeds: number;
  fixtureCount: number;
  metrics: Pl20FixtureMetrics;
  standardErrors: Pl20FixtureMetrics;
  minByFixture: Pl20FixtureMetrics;
  maxByFixture: Pl20FixtureMetrics;
}

export interface ShotCompositionMetrics {
  attZoneCarrierShots: number;
  midZoneCarrierShots: number;
  defZoneCarrierShots: number;
  speculativeShots: number;
  setPieceShots: number;
  chanceCreationShots: number;
  closeShots: number;
  mediumShots: number;
  longShots: number;
}

interface Context {
  version: Fc25DatasetVersion;
  clubs: Fc25Club[];
  squadCounts: Record<string, number>;
  squads: Record<string, LoadedSquad>;
}

interface LoadedSquad {
  clubId: Fc25ClubId;
  clubName: string;
  shortName: string;
  players: Fc25SquadPlayer[];
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
  awayFouls: number;
  totalCards: number;
  homeCards: number;
  awayCards: number;
  homePossession: number;
  awayPossession: number;
  corners: number;
  directFreeKicks: number;
  indirectFreeKicks: number;
  penalties: number;
  setPieceGoals: number;
  saves: number;
  cornersFromDeflectedShots: number;
  cornersFromDefensiveClearances: number;
  cornersFromSavedWide: number;
  cornersFromBlockedDelivery: number;
  shotComposition: ShotCompositionMetrics;
}

export function runFc26Pl20Baseline(
  options: Fc26Pl20BaselineOptions = {}
): Fc26Pl20BaselineReport {
  const db = getDb(options.databasePath);
  const context = buildContext(db);
  const sanitySeeds = options.sanitySeeds ?? 5;
  const seedsPerFixture = options.seedsPerFixture ?? DEFAULT_SEEDS_PER_FIXTURE;
  const fixtureMatrix = buildPl20DirectionalFixtureMatrix(context.clubs.map((club) => club.id)).slice(
    0,
    options.fixtureLimit
  );
  const sanity = runSanity(context, sanitySeeds);
  if (!sanity.pass) {
    throw new Error("FC26 PL20 baseline sanity check failed");
  }

  const runsByFixture = fixtureMatrix.map((fixture) => ({
    fixture,
    runs: runSeeds(seedsPerFixture, (seed) => simulate(context, fixture.home, fixture.away, seed))
  }));
  const fixtures = runsByFixture.map(({ fixture, runs }) => summariseFixture(fixture, runs));
  const aggregate = aggregateSummary(runsByFixture.flatMap(({ runs }) => runs), fixtures);
  const report: Fc26Pl20BaselineReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitSha: options.gitSha ?? "unknown",
    dataset: {
      id: context.version.id,
      name: context.version.name,
      sourceFile: context.version.source_file,
      sourceFileSha256: context.version.source_file_sha256,
      createdAt: context.version.created_at,
      clubCount: context.clubs.length,
      squadCounts: context.squadCounts
    },
    methodology: {
      clubUniverse: "english-premier-league-20",
      fixtureShape: "20 clubs, all ordered home/away pairings, no self-fixtures",
      seedsPerFixture,
      fixtureLimit: options.fixtureLimit ?? null,
      tactics: BASELINE_TACTICS
    },
    sanity,
    fixtureMatrix: fixtureMatrix.map((fixture) => ({ ...fixture, seeds: seedsPerFixture })),
    fixtures,
    aggregate,
    shotComposition: shotCompositionFromRuns(runsByFixture.flatMap(({ runs }) => runs)),
    homeAwayEffect: homeAwayEffect(fixtures),
    synthesis: {
      fixturesRun: fixtures.length,
      totalRuns: aggregate.seeds,
      recommendation:
        "Use this PL20 baseline as the immediate Phase 14 tuning input; Phase 12/13 five-club evidence remains diagnostic history."
    }
  };

  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function buildPl20DirectionalFixtureMatrix(
  clubIds: readonly Fc25ClubId[]
): Array<{ home: Fc25ClubId; away: Fc25ClubId }> {
  const fixtures: Array<{ home: Fc25ClubId; away: Fc25ClubId }> = [];
  for (const home of clubIds) {
    for (const away of clubIds) {
      if (home !== away) {
        fixtures.push({ home, away });
      }
    }
  }
  return fixtures;
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
  if (clubs.length !== EXPECTED_CLUB_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_CLUB_COUNT} active FC26 Premier League clubs, found ${clubs.length}`
    );
  }
  const squadCounts = Object.fromEntries(
    clubs.map((club) => [
      club.id,
      db
        .prepare<[string, string], { count: number }>(
          "SELECT COUNT(*) AS count FROM fc25_squads WHERE dataset_version_id = ? AND club_id = ?"
        )
        .get(version.id, club.id)?.count ?? 0
    ])
  );
  return {
    version,
    clubs,
    squadCounts,
    squads: Object.fromEntries(
      clubs.map((club) => [
        club.id,
        loadFc25Squad(club.id, version.id, { include: "all", db }) as LoadedSquad
      ])
    )
  };
}

function runSanity(context: Context, seeds: number): Fc26Pl20BaselineReport["sanity"] {
  const lineupWarnings: string[] = [];
  const activePlayersPerClub: Record<string, number> = {};
  for (const club of context.clubs) {
    const lineup = selectLineup(context.squads[club.id]!.players, BASELINE_FORMATION);
    activePlayersPerClub[club.id] = lineup.xi.length;
    lineupWarnings.push(
      ...lineup.warnings.map((warning) => `${club.id}:${warning.code}:${warning.playerId}`)
    );
  }
  const [first, second] = context.clubs;
  if (first && second) {
    runSeeds(seeds, (seed) => simulate(context, first.id, second.id, seed));
  }
  return {
    seeds,
    pass:
      Object.values(activePlayersPerClub).every((count) => count === 11) &&
      lineupWarnings.length === 0,
    activePlayersPerClub,
    lineupWarnings
  };
}

function simulate(
  context: Context,
  home: Fc25ClubId,
  away: Fc25ClubId,
  seed: number
): RunMetrics {
  const config: MatchConfigV2 = {
    seed,
    duration: "full_90",
    homeTeam: buildTeam(context.squads[home]!),
    awayTeam: buildTeam(context.squads[away]!),
    dynamics: {
      fatigue: true,
      scoreState: true,
      autoSubs: true,
      chanceCreation: true,
      setPieces: true,
      sideSwitch: true
    }
  };
  return metricsFor(seed, simulateMatch(config));
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

function metricsFor(seed: number, snapshot: MatchSnapshot): RunMetrics {
  const home = snapshot.finalSummary.statistics.home;
  const away = snapshot.finalSummary.statistics.away;
  const setPieces = snapshot.finalSummary.setPieces;
  const events = snapshot.ticks.flatMap((tick) => tick.events);
  const cornerEvents = events.filter((event) => event.type === "corner");
  return {
    seed,
    homeGoals: snapshot.finalSummary.finalScore.home,
    awayGoals: snapshot.finalSummary.finalScore.away,
    totalGoals: snapshot.finalSummary.finalScore.home + snapshot.finalSummary.finalScore.away,
    totalShots: home.shots.total + away.shots.total,
    homeShots: home.shots.total,
    awayShots: away.shots.total,
    totalFouls: home.fouls + away.fouls,
    homeFouls: home.fouls,
    awayFouls: away.fouls,
    totalCards: home.yellowCards + away.yellowCards + home.redCards + away.redCards,
    homeCards: home.yellowCards + home.redCards,
    awayCards: away.yellowCards + away.redCards,
    homePossession: home.possession,
    awayPossession: away.possession,
    corners: (setPieces?.home.corners ?? 0) + (setPieces?.away.corners ?? 0),
    directFreeKicks:
      (setPieces?.home.directFreeKicks ?? 0) + (setPieces?.away.directFreeKicks ?? 0),
    indirectFreeKicks:
      (setPieces?.home.indirectFreeKicks ?? 0) + (setPieces?.away.indirectFreeKicks ?? 0),
    penalties: (setPieces?.home.penalties ?? 0) + (setPieces?.away.penalties ?? 0),
    setPieceGoals: (setPieces?.home.setPieceGoals ?? 0) + (setPieces?.away.setPieceGoals ?? 0),
    saves: events.filter((event) => event.type === "save").length,
    cornersFromDeflectedShots: cornerEvents.filter(
      (event) => stringDetail(event, "reason") === "deflected_shot"
    ).length,
    cornersFromDefensiveClearances: cornerEvents.filter(
      (event) => stringDetail(event, "reason") === "defensive_clearance"
    ).length,
    cornersFromSavedWide: cornerEvents.filter(
      (event) => stringDetail(event, "reason") === "saved_wide"
    ).length,
    cornersFromBlockedDelivery: cornerEvents.filter(
      (event) => stringDetail(event, "reason") === "blocked_delivery"
    ).length,
    shotComposition: shotCompositionFor(snapshot)
  };
}

function summariseFixture(
  fixture: { home: Fc25ClubId; away: Fc25ClubId },
  runs: RunMetrics[]
): Pl20FixtureSummary {
  return {
    ...fixture,
    seeds: runs.length,
    metrics: metricsFrom(runs, average),
    standardErrors: metricsFrom(runs, standardError)
  };
}

function aggregateSummary(
  runs: RunMetrics[],
  fixtures: Pl20FixtureSummary[]
): Pl20AggregateSummary {
  const fixtureMetrics = fixtures.map((fixture) => fixture.metrics);
  return {
    seeds: runs.length,
    fixtureCount: fixtures.length,
    metrics: metricsFrom(runs, average),
    standardErrors: metricsFrom(runs, standardError),
    minByFixture: fixtureMetricsFrom(fixtureMetrics, Math.min),
    maxByFixture: fixtureMetricsFrom(fixtureMetrics, Math.max)
  };
}

function homeAwayEffect(fixtures: Pl20FixtureSummary[]): Fc26Pl20BaselineReport["homeAwayEffect"] {
  const goalDiffs = fixtures.map((fixture) => fixture.metrics.homeGoals - fixture.metrics.awayGoals);
  const shotDiffs = fixtures.map((fixture) => fixture.metrics.homeShots - fixture.metrics.awayShots);
  return {
    goals: { meanHomeMinusAway: average(goalDiffs), standardError: standardError(goalDiffs) },
    shots: { meanHomeMinusAway: average(shotDiffs), standardError: standardError(shotDiffs) }
  };
}

function metricsFrom(
  runs: RunMetrics[],
  summariser: (values: number[]) => number
): Pl20FixtureMetrics {
  return {
    homeShots: summariser(runs.map((run) => run.homeShots)),
    awayShots: summariser(runs.map((run) => run.awayShots)),
    totalShots: summariser(runs.map((run) => run.totalShots)),
    homeGoals: summariser(runs.map((run) => run.homeGoals)),
    awayGoals: summariser(runs.map((run) => run.awayGoals)),
    totalGoals: summariser(runs.map((run) => run.totalGoals)),
    homeFouls: summariser(runs.map((run) => run.homeFouls)),
    awayFouls: summariser(runs.map((run) => run.awayFouls)),
    totalFouls: summariser(runs.map((run) => run.totalFouls)),
    homeCards: summariser(runs.map((run) => run.homeCards)),
    awayCards: summariser(runs.map((run) => run.awayCards)),
    totalCards: summariser(runs.map((run) => run.totalCards)),
    homePossession: summariser(runs.map((run) => run.homePossession)),
    awayPossession: summariser(runs.map((run) => run.awayPossession)),
    corners: summariser(runs.map((run) => run.corners)),
    directFreeKicks: summariser(runs.map((run) => run.directFreeKicks)),
    indirectFreeKicks: summariser(runs.map((run) => run.indirectFreeKicks)),
    penalties: summariser(runs.map((run) => run.penalties)),
    setPieceGoals: summariser(runs.map((run) => run.setPieceGoals)),
    saves: summariser(runs.map((run) => run.saves)),
    cornersFromDeflectedShots: summariser(runs.map((run) => run.cornersFromDeflectedShots)),
    cornersFromDefensiveClearances: summariser(
      runs.map((run) => run.cornersFromDefensiveClearances)
    ),
    cornersFromSavedWide: summariser(runs.map((run) => run.cornersFromSavedWide)),
    cornersFromBlockedDelivery: summariser(runs.map((run) => run.cornersFromBlockedDelivery))
  };
}

function fixtureMetricsFrom(
  metrics: Pl20FixtureMetrics[],
  summariser: (...values: number[]) => number
): Pl20FixtureMetrics {
  const summarise = (key: keyof Pl20FixtureMetrics) =>
    metrics.length === 0 ? 0 : summariser(...metrics.map((metric) => metric[key]));
  return {
    homeShots: summarise("homeShots"),
    awayShots: summarise("awayShots"),
    totalShots: summarise("totalShots"),
    homeGoals: summarise("homeGoals"),
    awayGoals: summarise("awayGoals"),
    totalGoals: summarise("totalGoals"),
    homeFouls: summarise("homeFouls"),
    awayFouls: summarise("awayFouls"),
    totalFouls: summarise("totalFouls"),
    homeCards: summarise("homeCards"),
    awayCards: summarise("awayCards"),
    totalCards: summarise("totalCards"),
    homePossession: summarise("homePossession"),
    awayPossession: summarise("awayPossession"),
    corners: summarise("corners"),
    directFreeKicks: summarise("directFreeKicks"),
    indirectFreeKicks: summarise("indirectFreeKicks"),
    penalties: summarise("penalties"),
    setPieceGoals: summarise("setPieceGoals"),
    saves: summarise("saves"),
    cornersFromDeflectedShots: summarise("cornersFromDeflectedShots"),
    cornersFromDefensiveClearances: summarise("cornersFromDefensiveClearances"),
    cornersFromSavedWide: summarise("cornersFromSavedWide"),
    cornersFromBlockedDelivery: summarise("cornersFromBlockedDelivery")
  };
}

function runSeeds<T>(count: number, run: (seed: number) => T): T[] {
  return Array.from({ length: count }, (_, index) => run(index + 1));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shotCompositionFor(snapshot: MatchSnapshot): ShotCompositionMetrics {
  const shots = snapshot.ticks
    .flatMap((tick) => tick.events)
    .filter((event) => event.type === "shot");
  const carrierShots = shots.filter(
    (event) => detailObject(event, "setPieceContext") === null && stringDetail(event, "chanceSource") === null
  );
  return {
    attZoneCarrierShots: carrierShots.filter((event) => stringDetail(event, "fromZone") === "att").length,
    midZoneCarrierShots: carrierShots.filter((event) => stringDetail(event, "fromZone") === "mid").length,
    defZoneCarrierShots: carrierShots.filter((event) => stringDetail(event, "fromZone") === "def").length,
    speculativeShots: shots.filter((event) => stringDetail(event, "distanceBand") === "speculative").length,
    setPieceShots: shots.filter((event) => detailObject(event, "setPieceContext") !== null).length,
    chanceCreationShots: shots.filter((event) => stringDetail(event, "chanceSource") !== null).length,
    closeShots: shots.filter((event) => coarseDistanceBand(event) === "close").length,
    mediumShots: shots.filter((event) => coarseDistanceBand(event) === "medium").length,
    longShots: shots.filter((event) => coarseDistanceBand(event) === "long").length
  };
}

function shotCompositionFromRuns(runs: RunMetrics[]): ShotCompositionMetrics {
  return {
    attZoneCarrierShots: average(runs.map((run) => run.shotComposition.attZoneCarrierShots)),
    midZoneCarrierShots: average(runs.map((run) => run.shotComposition.midZoneCarrierShots)),
    defZoneCarrierShots: average(runs.map((run) => run.shotComposition.defZoneCarrierShots)),
    speculativeShots: average(runs.map((run) => run.shotComposition.speculativeShots)),
    setPieceShots: average(runs.map((run) => run.shotComposition.setPieceShots)),
    chanceCreationShots: average(runs.map((run) => run.shotComposition.chanceCreationShots)),
    closeShots: average(runs.map((run) => run.shotComposition.closeShots)),
    mediumShots: average(runs.map((run) => run.shotComposition.mediumShots)),
    longShots: average(runs.map((run) => run.shotComposition.longShots))
  };
}

function coarseDistanceBand(event: SemanticEvent): "close" | "medium" | "long" {
  const band = stringDetail(event, "distanceBand");
  if (band === "close" || band === "box") {
    return "close";
  }
  if (band === "edge") {
    return "medium";
  }
  return "long";
}

function stringDetail(event: SemanticEvent, key: string): string | null {
  const value = event.detail?.[key];
  return typeof value === "string" ? value : null;
}

function detailObject(event: SemanticEvent, key: string): Record<string, unknown> | null {
  const value = event.detail?.[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
