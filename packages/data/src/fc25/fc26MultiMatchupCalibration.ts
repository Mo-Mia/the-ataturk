import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  simulateMatch,
  type MatchConfigV2,
  type MatchSnapshot,
  type MatchDuration,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";
import { parse } from "csv-parse/sync";

import { getDb, type SqliteDatabase } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25DatasetVersion, Fc25SquadPlayer } from "../types";
import { getActiveFc25DatasetVersion, listFc25Clubs, loadFc25Squad } from "./importer";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/calibration-multi-matchup-fc26.json";
const EXPECTED_SOURCE_FILE = "FC26_20250921.csv";
const DEFAULT_PRIMARY_BENCHMARK_URL = "https://www.football-data.co.uk/mmz4281/2526/E0.csv";
const DEFAULT_CROSS_CHECK_BENCHMARK_URL = "https://www.football-data.co.uk/mmz4281/2425/E0.csv";
const EXPECTED_COUNTS = {
  arsenal: 24,
  "aston-villa": 24,
  liverpool: 28,
  "manchester-city": 26,
  "manchester-united": 26
} satisfies Partial<Record<Fc25ClubId, number>>;
type MultiMatchupClubId = keyof typeof EXPECTED_COUNTS & Fc25ClubId;
const CLUBS = Object.keys(EXPECTED_COUNTS) as MultiMatchupClubId[];
const CLUB_LABELS: Record<MultiMatchupClubId, string> = {
  arsenal: "Arsenal",
  "aston-villa": "Aston Villa",
  liverpool: "Liverpool",
  "manchester-city": "Manchester City",
  "manchester-united": "Manchester United"
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
const PHASE8_FULL90 = { shots: 18.06, goals: 2.73, fouls: 9.62, cards: 2.77 };

export interface Fc26MultiMatchupOptions {
  outputPath?: string;
  seedsPerFixture?: number;
  sanitySeeds?: number;
  databasePath?: string;
  gitSha?: string;
  primaryBenchmarkCsv?: string;
  crossCheckBenchmarkCsv?: string;
  primaryBenchmarkUrl?: string;
  crossCheckBenchmarkUrl?: string;
  accessedAt?: string;
}

export interface Fc26MultiMatchupReport {
  schemaVersion: 1;
  generatedAt: string;
  gitSha: string;
  dataset: {
    id: string;
    name: string;
    sourceFile: string;
    sourceFileSha256: string;
    createdAt: string;
    squadCounts: Record<MultiMatchupClubId, number>;
  };
  sanity: {
    seeds: number;
    pass: boolean;
    activePlayersPerClub: Record<MultiMatchupClubId, number>;
    lineupWarnings: string[];
    sampleFull90: DirectionalFixtureSummary;
  };
  fixtureMatrix: Array<{ home: MultiMatchupClubId; away: MultiMatchupClubId; seeds: number }>;
  fixtures: DirectionalFixtureSummary[];
  aggregate: AggregateSummary;
  varianceDecomposition: Record<BenchmarkMetric, VarianceDecomposition>;
  homeAwayEffect: HomeAwayEffect;
  realPlBenchmarks: {
    primary: RealPlBenchmarkSet;
    crossCheck: RealPlBenchmarkSet;
    gaps: BenchmarkGap[];
  };
  classifications: Phase12ClassificationRow[];
  rebasingInventory: RebasingInventory;
  synthesis: {
    bucket1: number;
    bucket2: number;
    bucket3: number;
    recommendation: string;
  };
}

export interface DirectionalFixtureSummary {
  home: MultiMatchupClubId;
  away: MultiMatchupClubId;
  seeds: number;
  metrics: FixtureMetrics;
  standardErrors: FixtureMetrics;
  scoreDistribution: Array<{ score: string; count: number; sharePct: number }>;
}

export interface FixtureMetrics {
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
  penaltyGoals: number;
  penaltyConversionPct: number;
}

export interface AggregateSummary {
  seeds: number;
  fixtureCount: number;
  metrics: FixtureMetrics;
  standardErrors: FixtureMetrics;
  penaltyAttempts: number;
  penaltyGoals: number;
  penaltyConversion: {
    pct: number;
    attempts: number;
    goals: number;
    confidenceInterval95Pct: [number, number] | null;
    note: string;
  };
}

export type BenchmarkMetric =
  | "totalShots"
  | "totalGoals"
  | "totalFouls"
  | "totalCards"
  | "corners";

export interface RealPlBenchmarkSet {
  season: "2025-26-to-date" | "2024-25-complete";
  sourceUrl: string;
  accessedAt: string;
  matchCount: number;
  complete: boolean;
  metrics: Record<BenchmarkMetric, RealPlMetric>;
  homeAdvantage: {
    goals: RealPlMetric;
    shots: RealPlMetric;
  };
  notes: string[];
}

export interface RealPlMetric {
  mean: number;
  standardDeviation: number;
  standardError: number;
}

export interface BenchmarkGap {
  metric: string;
  reason: string;
  fallback: string;
}

export interface VarianceDecomposition {
  totalVariance: number;
  withinFixtureVariance: number;
  betweenFixtureVariance: number;
  withinFixtureSharePct: number;
  betweenFixtureSharePct: number;
}

export interface HomeAwayEffect {
  goals: { meanHomeMinusAway: number; standardError: number };
  shots: { meanHomeMinusAway: number; standardError: number };
  possession: { meanHomeMinusAway: number; standardError: number };
  pairDirectionComparisons: Array<{
    pairing: string;
    firstDirection: { home: MultiMatchupClubId; away: MultiMatchupClubId; goalDiff: number; shotDiff: number };
    reverseDirection: { home: MultiMatchupClubId; away: MultiMatchupClubId; goalDiff: number; shotDiff: number };
  }>;
}

export interface Phase12ClassificationRow {
  metric: BenchmarkMetric;
  bucket: 1 | 2 | 3;
  fc26Mean: number;
  realPlPrimaryMean: number;
  realPlPrimarySd: number;
  realPlCrossCheckMean: number;
  phase8SyntheticMean: number | null;
  rationale: string;
  recommendation: string;
  confidence: "high" | "medium" | "low";
}

export interface RebasingInventory {
  tests: string[];
  docs: string[];
  process: string[];
}

interface Context {
  version: Fc25DatasetVersion;
  squadCounts: Record<MultiMatchupClubId, number>;
  squads: Record<MultiMatchupClubId, LoadedSquad>;
}

interface LoadedSquad {
  clubId: MultiMatchupClubId;
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
  penaltyGoals: number;
  setPieceGoals: number;
  score: string;
}

interface FootballDataCsvRow {
  FTHG?: string;
  FTAG?: string;
  HS?: string;
  AS?: string;
  HF?: string;
  AF?: string;
  HC?: string;
  AC?: string;
  HY?: string;
  AY?: string;
  HR?: string;
  AR?: string;
}

export async function runFc26MultiMatchupCalibration(
  options: Fc26MultiMatchupOptions = {}
): Promise<Fc26MultiMatchupReport> {
  const db = getDb(options.databasePath);
  const context = buildContext(db);
  const sanitySeeds = options.sanitySeeds ?? 50;
  const seedsPerFixture = options.seedsPerFixture ?? 100;
  const fixtureMatrix = buildDirectionalFixtureMatrix();
  const accessedAt = options.accessedAt ?? new Date().toISOString().slice(0, 10);
  const primaryBenchmarkUrl = options.primaryBenchmarkUrl ?? DEFAULT_PRIMARY_BENCHMARK_URL;
  const crossCheckBenchmarkUrl = options.crossCheckBenchmarkUrl ?? DEFAULT_CROSS_CHECK_BENCHMARK_URL;
  const [primaryCsv, crossCheckCsv] = await Promise.all([
    options.primaryBenchmarkCsv ?? fetchText(primaryBenchmarkUrl),
    options.crossCheckBenchmarkCsv ?? fetchText(crossCheckBenchmarkUrl)
  ]);
  const primaryBenchmark = parseFootballDataBenchmark({
    csv: primaryCsv,
    season: "2025-26-to-date",
    sourceUrl: primaryBenchmarkUrl,
    accessedAt,
    complete: false
  });
  const crossCheckBenchmark = parseFootballDataBenchmark({
    csv: crossCheckCsv,
    season: "2024-25-complete",
    sourceUrl: crossCheckBenchmarkUrl,
    accessedAt,
    complete: true
  });
  const sanity = runSanity(context, sanitySeeds);
  if (!sanity.pass) {
    throw new Error("FC26 multi-matchup sanity check failed");
  }
  const runsByFixture = fixtureMatrix.map((fixture) => ({
    ...fixture,
    runs: fixtureRuns(context, fixture.home, fixture.away, seedsPerFixture)
  }));
  const fixtures = runsByFixture.map((fixture) =>
    summariseDirectionalFixture(fixture.home, fixture.away, fixture.runs)
  );
  const allRuns = runsByFixture.flatMap((fixture) => fixture.runs);
  const aggregate = aggregateSummary(allRuns, fixtures.length);
  const varianceDecomposition = buildVarianceDecomposition(runsByFixture.map((fixture) => fixture.runs));
  const homeAwayEffect = buildHomeAwayEffect(fixtures);
  const classifications = classifyAgainstRealPl(
    aggregate.metrics,
    primaryBenchmark,
    crossCheckBenchmark
  );
  const synthesis = synthesisFor(classifications);
  const report: Fc26MultiMatchupReport = {
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
    fixtureMatrix: fixtureMatrix.map((fixture) => ({ ...fixture, seeds: seedsPerFixture })),
    fixtures,
    aggregate,
    varianceDecomposition,
    homeAwayEffect,
    realPlBenchmarks: {
      primary: primaryBenchmark,
      crossCheck: crossCheckBenchmark,
      gaps: benchmarkGaps()
    },
    classifications,
    rebasingInventory: rebasingInventory(),
    synthesis
  };

  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function buildDirectionalFixtureMatrix(): Array<{ home: MultiMatchupClubId; away: MultiMatchupClubId }> {
  const fixtures: Array<{ home: MultiMatchupClubId; away: MultiMatchupClubId }> = [];
  for (let homeIndex = 0; homeIndex < CLUBS.length; homeIndex += 1) {
    for (let awayIndex = homeIndex + 1; awayIndex < CLUBS.length; awayIndex += 1) {
      const first = CLUBS[homeIndex]!;
      const second = CLUBS[awayIndex]!;
      fixtures.push({ home: first, away: second }, { home: second, away: first });
    }
  }
  return fixtures;
}

export function parseFootballDataBenchmark(input: {
  csv: string;
  season: RealPlBenchmarkSet["season"];
  sourceUrl: string;
  accessedAt: string;
  complete: boolean;
}): RealPlBenchmarkSet {
  const normalised = input.csv.replace(/^\uFEFF/, "");
  const rows = parse<FootballDataCsvRow>(normalised, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  const finished = rows.filter((row) => row.FTHG !== undefined && row.FTHG !== "");
  const metrics = finished.map((row) => {
    const homeGoals = numberField(row.FTHG, "FTHG");
    const awayGoals = numberField(row.FTAG, "FTAG");
    const homeShots = numberField(row.HS, "HS");
    const awayShots = numberField(row.AS, "AS");
    const homeFouls = numberField(row.HF, "HF");
    const awayFouls = numberField(row.AF, "AF");
    const homeCorners = numberField(row.HC, "HC");
    const awayCorners = numberField(row.AC, "AC");
    const homeCards = numberField(row.HY, "HY") + numberField(row.HR, "HR");
    const awayCards = numberField(row.AY, "AY") + numberField(row.AR, "AR");
    return {
      totalGoals: homeGoals + awayGoals,
      totalShots: homeShots + awayShots,
      totalFouls: homeFouls + awayFouls,
      totalCards: homeCards + awayCards,
      corners: homeCorners + awayCorners,
      goalHomeAdvantage: homeGoals - awayGoals,
      shotHomeAdvantage: homeShots - awayShots
    };
  });
  if (metrics.length === 0) {
    throw new Error(`No completed matches found in ${input.sourceUrl}`);
  }
  return {
    season: input.season,
    sourceUrl: input.sourceUrl,
    accessedAt: input.accessedAt,
    matchCount: metrics.length,
    complete: input.complete,
    metrics: {
      totalShots: metricStats(metrics.map((row) => row.totalShots)),
      totalGoals: metricStats(metrics.map((row) => row.totalGoals)),
      totalFouls: metricStats(metrics.map((row) => row.totalFouls)),
      totalCards: metricStats(metrics.map((row) => row.totalCards)),
      corners: metricStats(metrics.map((row) => row.corners))
    },
    homeAdvantage: {
      goals: metricStats(metrics.map((row) => row.goalHomeAdvantage)),
      shots: metricStats(metrics.map((row) => row.shotHomeAdvantage))
    },
    notes:
      input.season === "2025-26-to-date"
        ? ["Primary benchmark is provisional because the 2025/26 Premier League season is still in progress."]
        : ["Cross-check benchmark is a complete prior season and is used to detect current-season volatility."]
  };
}

export function classifyAgainstRealPl(
  fc26: FixtureMetrics,
  primary: RealPlBenchmarkSet,
  crossCheck: RealPlBenchmarkSet
): Phase12ClassificationRow[] {
  return (["totalShots", "totalGoals", "totalFouls", "totalCards", "corners"] as BenchmarkMetric[]).map(
    (metric) => {
      const fc26Mean = fc26[metric];
      const primaryMetric = primary.metrics[metric];
      const crossCheckMetric = crossCheck.metrics[metric];
      const z = Math.abs(fc26Mean - primaryMetric.mean) / primaryMetric.standardDeviation;
      const crossCheckZ =
        Math.abs(fc26Mean - crossCheckMetric.mean) / crossCheckMetric.standardDeviation;
      const phase8SyntheticMean = metric in PHASE8_FULL90
        ? PHASE8_FULL90[metric as keyof typeof PHASE8_FULL90]
        : null;
      const benchmarkDisagrees =
        Math.abs(primaryMetric.mean - crossCheckMetric.mean) > primaryMetric.standardDeviation;
      if (z <= 1) {
        return {
          metric,
          bucket: 1,
          fc26Mean,
          realPlPrimaryMean: primaryMetric.mean,
          realPlPrimarySd: primaryMetric.standardDeviation,
          realPlCrossCheckMean: crossCheckMetric.mean,
          phase8SyntheticMean,
          rationale: "FC26 cross-matchup mean is within one current-season real-PL standard deviation.",
          recommendation: "Treat as real-PL realistic; no tuning recommendation.",
          confidence: benchmarkDisagrees ? "medium" : "high"
        };
      }
      if (z <= 2 || crossCheckZ <= 1) {
        return {
          metric,
          bucket: 2,
          fc26Mean,
          realPlPrimaryMean: primaryMetric.mean,
          realPlPrimarySd: primaryMetric.standardDeviation,
          realPlCrossCheckMean: crossCheckMetric.mean,
          phase8SyntheticMean,
          rationale:
            z <= 2
              ? "FC26 is outside one current-season SD but inside two SDs."
              : "FC26 is outside the provisional current-season band but aligned with the complete-season cross-check.",
          recommendation: "Document as defensible drift; avoid tuning from this metric alone.",
          confidence: benchmarkDisagrees ? "low" : "medium"
        };
      }
      return {
        metric,
        bucket: 3,
        fc26Mean,
        realPlPrimaryMean: primaryMetric.mean,
        realPlPrimarySd: primaryMetric.standardDeviation,
        realPlCrossCheckMean: crossCheckMetric.mean,
        phase8SyntheticMean,
        rationale: "FC26 is more than two current-season real-PL SDs away and not rescued by the 2024/25 cross-check.",
        recommendation: "Surface for Mo/SA before rebasing; consider a tuning investigation for this metric.",
        confidence: benchmarkDisagrees ? "medium" : "high"
      };
    }
  );
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
  ) as Record<MultiMatchupClubId, number>;
  for (const [clubId, expected] of Object.entries(EXPECTED_COUNTS) as Array<[MultiMatchupClubId, number]>) {
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
      MultiMatchupClubId,
      LoadedSquad
    >
  };
}

function loadSquad(clubId: MultiMatchupClubId, versionId: string, db: SqliteDatabase): LoadedSquad {
  return { ...loadFc25Squad(clubId, versionId, { include: "all", db }), clubId };
}

function runSanity(
  context: Context,
  seeds: number
): Fc26MultiMatchupReport["sanity"] {
  const lineupWarnings: string[] = [];
  const activePlayersPerClub = {} as Record<MultiMatchupClubId, number>;
  for (const clubId of CLUBS) {
    const lineup = selectLineup(context.squads[clubId].players, BASELINE_FORMATION);
    activePlayersPerClub[clubId] = lineup.xi.length;
    lineupWarnings.push(
      ...lineup.warnings.map((warning) => `${clubId}:${warning.code}:${warning.playerId}`)
    );
  }
  const runs = runSeeds(seeds, (seed) => simulate(context, seed, "liverpool", "manchester-city"));
  return {
    seeds,
    pass:
      Object.values(activePlayersPerClub).every((count) => count === 11) &&
      lineupWarnings.length === 0,
    activePlayersPerClub,
    lineupWarnings,
    sampleFull90: summariseDirectionalFixture("liverpool", "manchester-city", runs)
  };
}

function fixtureRuns(
  context: Context,
  home: MultiMatchupClubId,
  away: MultiMatchupClubId,
  seeds: number
): RunMetrics[] {
  return runSeeds(seeds, (seed) => simulate(context, seed, home, away));
}

function summariseDirectionalFixture(
  home: MultiMatchupClubId,
  away: MultiMatchupClubId,
  runs: RunMetrics[]
): DirectionalFixtureSummary {
  return {
    home,
    away,
    seeds: runs.length,
    metrics: fixtureMetrics(runs),
    standardErrors: fixtureStandardErrors(runs),
    scoreDistribution: scoreDistribution(runs)
  };
}

function simulate(
  context: Context,
  seed: number,
  home: MultiMatchupClubId,
  away: MultiMatchupClubId,
  duration: MatchDuration = "full_90"
): RunMetrics {
  const config: MatchConfigV2 = {
    seed,
    duration,
    homeTeam: buildTeam(context.squads[home]),
    awayTeam: buildTeam(context.squads[away]),
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
  const { home, away } = snapshot.finalSummary.statistics;
  const setPieces = snapshot.finalSummary.setPieces;
  const penaltyGoals = countPenaltyGoals(snapshot);
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
    penaltyGoals,
    setPieceGoals: (setPieces?.home.setPieceGoals ?? 0) + (setPieces?.away.setPieceGoals ?? 0),
    score: `${snapshot.finalSummary.finalScore.home}-${snapshot.finalSummary.finalScore.away}`
  };
}

function fixtureMetrics(runs: RunMetrics[]): FixtureMetrics {
  const penalties = average(runs.map((run) => run.penalties));
  const penaltyGoals = average(runs.map((run) => run.penaltyGoals));
  return {
    homeShots: average(runs.map((run) => run.homeShots)),
    awayShots: average(runs.map((run) => run.awayShots)),
    totalShots: average(runs.map((run) => run.totalShots)),
    homeGoals: average(runs.map((run) => run.homeGoals)),
    awayGoals: average(runs.map((run) => run.awayGoals)),
    totalGoals: average(runs.map((run) => run.totalGoals)),
    homeFouls: average(runs.map((run) => run.homeFouls)),
    awayFouls: average(runs.map((run) => run.awayFouls)),
    totalFouls: average(runs.map((run) => run.totalFouls)),
    homeCards: average(runs.map((run) => run.homeCards)),
    awayCards: average(runs.map((run) => run.awayCards)),
    totalCards: average(runs.map((run) => run.totalCards)),
    homePossession: average(runs.map((run) => run.homePossession)),
    awayPossession: average(runs.map((run) => run.awayPossession)),
    corners: average(runs.map((run) => run.corners)),
    directFreeKicks: average(runs.map((run) => run.directFreeKicks)),
    indirectFreeKicks: average(runs.map((run) => run.indirectFreeKicks)),
    penalties,
    setPieceGoals: average(runs.map((run) => run.setPieceGoals)),
    penaltyGoals,
    penaltyConversionPct: penalties === 0 ? 0 : (penaltyGoals / penalties) * 100
  };
}

function fixtureStandardErrors(runs: RunMetrics[]): FixtureMetrics {
  return {
    homeShots: standardError(runs.map((run) => run.homeShots)),
    awayShots: standardError(runs.map((run) => run.awayShots)),
    totalShots: standardError(runs.map((run) => run.totalShots)),
    homeGoals: standardError(runs.map((run) => run.homeGoals)),
    awayGoals: standardError(runs.map((run) => run.awayGoals)),
    totalGoals: standardError(runs.map((run) => run.totalGoals)),
    homeFouls: standardError(runs.map((run) => run.homeFouls)),
    awayFouls: standardError(runs.map((run) => run.awayFouls)),
    totalFouls: standardError(runs.map((run) => run.totalFouls)),
    homeCards: standardError(runs.map((run) => run.homeCards)),
    awayCards: standardError(runs.map((run) => run.awayCards)),
    totalCards: standardError(runs.map((run) => run.totalCards)),
    homePossession: standardError(runs.map((run) => run.homePossession)),
    awayPossession: standardError(runs.map((run) => run.awayPossession)),
    corners: standardError(runs.map((run) => run.corners)),
    directFreeKicks: standardError(runs.map((run) => run.directFreeKicks)),
    indirectFreeKicks: standardError(runs.map((run) => run.indirectFreeKicks)),
    penalties: standardError(runs.map((run) => run.penalties)),
    setPieceGoals: standardError(runs.map((run) => run.setPieceGoals)),
    penaltyGoals: standardError(runs.map((run) => run.penaltyGoals)),
    penaltyConversionPct: 0
  };
}

function aggregateSummary(runs: RunMetrics[], fixtureCount: number): AggregateSummary {
  const penalties = runs.reduce((sum, run) => sum + run.penalties, 0);
  const penaltyGoals = runs.reduce((sum, run) => sum + run.penaltyGoals, 0);
  const pct = penalties === 0 ? 0 : (penaltyGoals / penalties) * 100;
  return {
    seeds: runs.length,
    fixtureCount,
    metrics: fixtureMetrics(runs),
    standardErrors: fixtureStandardErrors(runs),
    penaltyAttempts: penalties,
    penaltyGoals,
    penaltyConversion: {
      pct,
      attempts: penalties,
      goals: penaltyGoals,
      confidenceInterval95Pct: penalties < 20 ? null : wilsonIntervalPct(penaltyGoals, penalties),
      note:
        penalties < 20
          ? "Penalty conversion is diagnostic only because fewer than 20 simulated penalties occurred."
          : "Penalty conversion uses a Wilson 95% interval from aggregate attempts."
    }
  };
}

function buildVarianceDecomposition(runsByFixture: RunMetrics[][]): Record<BenchmarkMetric, VarianceDecomposition> {
  const result = {} as Record<BenchmarkMetric, VarianceDecomposition>;
  for (const metric of ["totalShots", "totalGoals", "totalFouls", "totalCards", "corners"] as BenchmarkMetric[]) {
    const groups = runsByFixture.map((runs) => runs.map((run) => run[metric]));
    result[metric] = varianceDecomposition(groups);
  }
  return result;
}

function buildHomeAwayEffect(fixtures: DirectionalFixtureSummary[]): HomeAwayEffect {
  const goalDiffs = fixtures.map((fixture) => fixture.metrics.homeGoals - fixture.metrics.awayGoals);
  const shotDiffs = fixtures.map((fixture) => fixture.metrics.homeShots - fixture.metrics.awayShots);
  const possessionDiffs = fixtures.map(
    (fixture) => fixture.metrics.homePossession - fixture.metrics.awayPossession
  );
  return {
    goals: { meanHomeMinusAway: average(goalDiffs), standardError: standardError(goalDiffs) },
    shots: { meanHomeMinusAway: average(shotDiffs), standardError: standardError(shotDiffs) },
    possession: {
      meanHomeMinusAway: average(possessionDiffs),
      standardError: standardError(possessionDiffs)
    },
    pairDirectionComparisons: buildDirectionalFixtureMatrix()
      .filter((fixture, index) => index % 2 === 0)
      .map((fixture) => {
        const reverse = { home: fixture.away, away: fixture.home };
        const first = fixtureFor(fixtures, fixture.home, fixture.away);
        const second = fixtureFor(fixtures, reverse.home, reverse.away);
        return {
          pairing: `${CLUB_LABELS[fixture.home]} / ${CLUB_LABELS[fixture.away]}`,
          firstDirection: {
            home: fixture.home,
            away: fixture.away,
            goalDiff: first.metrics.homeGoals - first.metrics.awayGoals,
            shotDiff: first.metrics.homeShots - first.metrics.awayShots
          },
          reverseDirection: {
            home: reverse.home,
            away: reverse.away,
            goalDiff: second.metrics.homeGoals - second.metrics.awayGoals,
            shotDiff: second.metrics.homeShots - second.metrics.awayShots
          }
        };
      })
  };
}

function fixtureFor(
  fixtures: DirectionalFixtureSummary[],
  home: Fc25ClubId,
  away: Fc25ClubId
): DirectionalFixtureSummary {
  const fixture = fixtures.find((row) => row.home === home && row.away === away);
  if (!fixture) {
    throw new Error(`Missing fixture ${home} vs ${away}`);
  }
  return fixture;
}

function varianceDecomposition(groups: number[][]): VarianceDecomposition {
  const allValues = groups.flat();
  const grandMean = average(allValues);
  const totalVariance = sampleVariance(allValues);
  const withinFixtureVariance = average(groups.map(sampleVariance));
  const betweenMeanSquare =
    groups.reduce((sum, group) => sum + group.length * (average(group) - grandMean) ** 2, 0) /
    Math.max(1, groups.length - 1);
  const meanGroupSize = average(groups.map((group) => group.length));
  const betweenFixtureVariance = Math.max(0, (betweenMeanSquare - withinFixtureVariance) / meanGroupSize);
  const denominator = withinFixtureVariance + betweenFixtureVariance;
  return {
    totalVariance,
    withinFixtureVariance,
    betweenFixtureVariance,
    withinFixtureSharePct: denominator === 0 ? 0 : (withinFixtureVariance / denominator) * 100,
    betweenFixtureSharePct: denominator === 0 ? 0 : (betweenFixtureVariance / denominator) * 100
  };
}

function benchmarkGaps(): BenchmarkGap[] {
  return [
    {
      metric: "possession",
      reason:
        "Football-Data.co.uk E0 CSV does not include possession, and the current football-data.org token did not expose match statistics.",
      fallback: "Document FC26 possession and compare qualitatively only."
    },
    {
      metric: "direct and indirect free kicks",
      reason:
        "Football-Data.co.uk does not split free kicks, and football-data.org detailed statistics were not available on the current token.",
      fallback: "Keep as simulated diagnostic metrics, not rebasing gates."
    },
    {
      metric: "penalties and penalty conversion",
      reason:
        "Football-Data.co.uk records match scores and cards/corners/shots/fouls but not penalty attempts in the E0 CSV.",
      fallback: "Use FC26 aggregate Wilson interval for diagnostics and keep Phase 8 set-piece reference historical."
    },
    {
      metric: "set-piece goals",
      reason:
        "Public benchmark source does not separate set-piece goals in the match-level CSV.",
      fallback: "Report FC26 set-piece goals but do not classify against real-PL in Phase 12."
    }
  ];
}

function rebasingInventory(): RebasingInventory {
  return {
    tests: [
      "packages/match-engine/scripts/characterise.ts target reporting",
      "packages/match-engine/test/calibration/calibrationSensitivity.test.ts convention notes",
      "apps/web visualiser tests that fixture snapshot targets as display data, not calibration policy"
    ],
    docs: [
      "docs/CALIBRATION_REFERENCE.md",
      "docs/CALIBRATION_BASELINE_PHASE_8.md",
      "docs/CALIBRATION_BASELINE_FC26.md",
      "docs/UAT_FOOTSIM_ANALYST_PROMPT.md",
      "docs/MATCH_ENGINE_MODEL_GAPS.md"
    ],
    process: [
      "Treat Phase 8 synthetic bands as historical once a future rebasing sprint executes.",
      "Use current real-PL benchmark refreshes as the active calibration-policy input.",
      "Keep dataset-version-specific baselines separate from engine synthetic scenario checks."
    ]
  };
}

function synthesisFor(classifications: Phase12ClassificationRow[]): Fc26MultiMatchupReport["synthesis"] {
  const bucket1 = classifications.filter((row) => row.bucket === 1).length;
  const bucket2 = classifications.filter((row) => row.bucket === 2).length;
  const bucket3 = classifications.filter((row) => row.bucket === 3).length;
  return {
    bucket1,
    bucket2,
    bucket3,
    recommendation:
      bucket3 > 0
        ? "Do not execute a pure rebasing sprint yet; discuss Bucket 3 real-PL drift before tuning or rebasing."
        : bucket2 > 0
          ? "Proceed with a rebasing-only sprint for Bucket 1/2 metrics; no engine tuning is recommended from Phase 12."
          : "Proceed with a clean rebasing-only sprint; FC26 multi-matchup output is real-PL realistic on classified metrics."
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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

function metricStats(values: number[]): RealPlMetric {
  return {
    mean: average(values),
    standardDeviation: standardDeviation(values),
    standardError: standardError(values)
  };
}

function numberField(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Football-Data.co.uk row has invalid ${name} value '${value}'`);
  }
  return parsed;
}

function runSeeds<T>(seeds: number, runner: (seed: number) => T): T[] {
  return Array.from({ length: seeds }, (_, index) => runner(index + 1));
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

function standardDeviation(values: number[]): number {
  return Math.sqrt(sampleVariance(values));
}

function standardError(values: number[]): number {
  return values.length < 2 ? 0 : standardDeviation(values) / Math.sqrt(values.length);
}

function wilsonIntervalPct(successes: number, attempts: number): [number, number] {
  if (attempts === 0) {
    return [0, 0];
  }
  const z = 1.96;
  const p = successes / attempts;
  const denominator = 1 + (z ** 2) / attempts;
  const centre = p + (z ** 2) / (2 * attempts);
  const margin = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * attempts)) / attempts);
  return [((centre - margin) / denominator) * 100, ((centre + margin) / denominator) * 100];
}
