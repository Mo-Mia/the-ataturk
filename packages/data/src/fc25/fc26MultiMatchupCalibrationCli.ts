import { execSync } from "node:child_process";

import { runFc26MultiMatchupCalibration } from "./fc26MultiMatchupCalibration";

const startedAt = Date.now();
const report = await runFc26MultiMatchupCalibration({
  ...parseArgs(process.argv.slice(2)),
  gitSha: currentGitSha()
});
const elapsedSeconds = (Date.now() - startedAt) / 1000;

console.log(`FC26 multi-matchup dataset: ${report.dataset.id}`);
console.log(
  `Sanity: ${report.sanity.pass ? "PASS" : "FAIL"} (${report.sanity.seeds} seeds, sample ${report.sanity.sampleFull90.metrics.totalGoals.toFixed(
    2
  )} goals)`
);
console.log(
  `Fixtures: ${report.fixtureMatrix.length} directional fixtures x ${report.fixtureMatrix[0]?.seeds ?? 0} seeds`
);
console.log(
  `Aggregate: shots ${report.aggregate.metrics.totalShots.toFixed(2)}, goals ${report.aggregate.metrics.totalGoals.toFixed(
    2
  )}, fouls ${report.aggregate.metrics.totalFouls.toFixed(2)}, cards ${report.aggregate.metrics.totalCards.toFixed(
    2
  )}, corners ${report.aggregate.metrics.corners.toFixed(2)}`
);
console.log(
  `Primary real-PL: ${report.realPlBenchmarks.primary.season}, ${report.realPlBenchmarks.primary.matchCount} matches`
);
console.log(
  `Buckets: ${report.synthesis.bucket1}/${report.synthesis.bucket2}/${report.synthesis.bucket3}`
);
console.log(`Elapsed: ${elapsedSeconds.toFixed(1)}s`);
console.log(report.synthesis.recommendation);

if (elapsedSeconds > 60 * 60) {
  console.error("Phase 12 measurement exceeded 60 minutes; surface for Mo.");
  process.exitCode = 3;
} else if (report.synthesis.bucket3 > 0) {
  process.exitCode = 2;
}

function parseArgs(args: string[]): {
  outputPath?: string;
  seedsPerFixture?: number;
  sanitySeeds?: number;
  databasePath?: string;
  primaryBenchmarkUrl?: string;
  crossCheckBenchmarkUrl?: string;
  accessedAt?: string;
} {
  const options: {
    outputPath?: string;
    seedsPerFixture?: number;
    sanitySeeds?: number;
    databasePath?: string;
    primaryBenchmarkUrl?: string;
    crossCheckBenchmarkUrl?: string;
    accessedAt?: string;
  } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = args[index + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--output" && next) {
      options.outputPath = next;
      index += 1;
    } else if (arg === "--database" && next) {
      options.databasePath = next;
      index += 1;
    } else if (arg === "--seeds-per-fixture" && next) {
      options.seedsPerFixture = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--sanity-seeds" && next) {
      options.sanitySeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--primary-benchmark-url" && next) {
      options.primaryBenchmarkUrl = next;
      index += 1;
    } else if (arg === "--cross-check-benchmark-url" && next) {
      options.crossCheckBenchmarkUrl = next;
      index += 1;
    } else if (arg === "--accessed-at" && next) {
      options.accessedAt = next;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option '${arg}'`);
    }
  }

  return options;
}

function positiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} value '${value}'`);
  }
  return parsed;
}

function currentGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
