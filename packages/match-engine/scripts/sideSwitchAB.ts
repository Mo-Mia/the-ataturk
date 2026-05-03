import { simulateMatch, type MatchConfigV2 } from "../src";
import { createTestConfigV2 } from "../test/helpers";

interface MetricSample {
  shots: number;
  goals: number;
  fouls: number;
  cards: number;
  possession: number;
  corners: number;
  setPieceGoals: number;
}

interface MetricResult {
  metric: keyof MetricSample;
  offMean: number;
  onMean: number;
  diff: number;
  pooledStandardError: number;
  threshold: number;
  pass: boolean;
}

const seeds = parseSeeds(process.argv);
const offSamples = seeds.map((seed) => sample(seed, false));
const onSamples = seeds.map((seed) => sample(seed, true));
const results = metricNames().map((metric) => compare(metric, offSamples, onSamples));
const passed = results.every((result) => result.pass);

console.log(`=== Side-switch A/B (${seeds.length} seeds per mode) ===`);
console.log("Criterion: abs(mean OFF - mean ON) < 2 * pooled standard error");
for (const result of results) {
  console.log(
    `${result.pass ? "PASS" : "FAIL"} ${result.metric}: off=${format(result.offMean)} on=${format(
      result.onMean
    )} diff=${format(result.diff)} threshold=${format(result.threshold)}`
  );
}

if (!passed) {
  process.exitCode = 1;
}

function sample(seed: number, sideSwitch: boolean): MetricSample {
  const snapshot = simulateMatch(config(seed, sideSwitch));
  const home = snapshot.finalSummary.statistics.home;
  const away = snapshot.finalSummary.statistics.away;
  const setPieces = snapshot.finalSummary.setPieces;
  return {
    shots: home.shots.total + away.shots.total,
    goals: home.goals + away.goals,
    fouls: home.fouls + away.fouls,
    cards: home.yellowCards + home.redCards + away.yellowCards + away.redCards,
    possession: home.possession,
    corners: (setPieces?.home.corners ?? 0) + (setPieces?.away.corners ?? 0),
    setPieceGoals: (setPieces?.home.setPieceGoals ?? 0) + (setPieces?.away.setPieceGoals ?? 0)
  };
}

function config(seed: number, sideSwitch: boolean): MatchConfigV2 {
  return {
    ...createTestConfigV2(seed, { preferredFoot: "right", weakFootRating: 4 }),
    duration: "full_90",
    dynamics: {
      fatigue: true,
      scoreState: true,
      autoSubs: true,
      chanceCreation: true,
      setPieces: true,
      sideSwitch
    }
  };
}

function compare(
  metric: keyof MetricSample,
  offSamples: MetricSample[],
  onSamples: MetricSample[]
): MetricResult {
  const offValues = offSamples.map((sample) => sample[metric]);
  const onValues = onSamples.map((sample) => sample[metric]);
  const offMean = mean(offValues);
  const onMean = mean(onValues);
  const pooledStandardError = Math.sqrt(
    standardError(offValues) ** 2 + standardError(onValues) ** 2
  );
  const diff = Math.abs(offMean - onMean);
  const threshold = 2 * pooledStandardError;
  return {
    metric,
    offMean,
    onMean,
    diff,
    pooledStandardError,
    threshold,
    pass: diff < threshold
  };
}

function metricNames(): Array<keyof MetricSample> {
  return ["shots", "goals", "fouls", "cards", "possession", "corners", "setPieceGoals"];
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardError(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.sqrt(values.length);
}

function format(value: number): string {
  return value.toFixed(3);
}

function parseSeeds(args: string[]): number[] {
  const seedFlagIndex = args.indexOf("--seeds");
  const seedCountArg =
    args.find((arg) => arg.startsWith("--seeds="))?.slice("--seeds=".length) ??
    (seedFlagIndex >= 0 ? args[seedFlagIndex + 1] : undefined);
  const count = seedCountArg ? Number(seedCountArg) : 500;
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Expected --seeds to be a positive integer");
  }
  return Array.from({ length: count }, (_, index) => index + 1);
}
