import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  simulateMatch,
  type MatchSnapshot,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";

import { getDb } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25SquadPlayer } from "../types";
import { FC25_SOURCE_FILE_DEFAULT } from "./constants";
import { importFc25Dataset, loadFc25Squad } from "./importer";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

type MetricKey = "homeShots" | "homeFouls" | "homePossessionStreak" | "homeGoals";

interface RunMetrics {
  seed: number;
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeFouls: number;
  awayFouls: number;
  homePossessionStreak: number;
  homeWideDeliveries: number;
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
        thresholdPct: 15,
        seeds,
        baseline: (seed) => simulate(liverpool, city, seed),
        variant: (seed) =>
          simulate(liverpool, city, seed, { homeStartingPlayerIds: rotation.rotatedIds })
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
      pass: comparisons.every((comparison) => comparison.status === "PASS")
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function compareScenario(options: {
  name: string;
  baselineLabel: string;
  variantLabel: string;
  metric: MetricKey;
  thresholdPct: number;
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
    status: Math.abs(deltaPct) >= options.thresholdPct ? "PASS" : "FAIL"
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
  } = {}
): RunMetrics {
  const homeTactics = { ...BASELINE_TACTICS, ...overrides.homeTactics };
  const awayTactics = { ...BASELINE_TACTICS, ...overrides.awayTactics };
  const snapshot = simulateMatch({
    seed,
    duration: "full_90",
    homeTeam: buildTeam(home, homeTactics, overrides.homeStartingPlayerIds),
    awayTeam: buildTeam(away, awayTactics)
  });
  return metricsFor(seed, snapshot);
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
  return {
    seed,
    homeGoals: snapshot.finalSummary.finalScore.home,
    awayGoals: snapshot.finalSummary.finalScore.away,
    homeShots: home.shots.total,
    awayShots: away.shots.total,
    homeFouls: home.fouls,
    awayFouls: away.fouls,
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
    ).length
  };
}

function runSeeds(seeds: number, runner: (seed: number) => RunMetrics): RunMetrics[] {
  return Array.from({ length: seeds }, (_, index) => runner(index + 1));
}

function averagesFor<T extends keyof RunMetrics>(
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
