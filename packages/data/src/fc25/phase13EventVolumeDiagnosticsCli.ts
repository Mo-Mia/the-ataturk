import { execSync } from "node:child_process";

import { runPhase13EventVolumeDiagnostics } from "./phase13EventVolumeDiagnostics";

const startedAt = Date.now();
const report = runPhase13EventVolumeDiagnostics({
  ...parseArgs(process.argv.slice(2)),
  gitSha: currentGitSha()
});
const elapsedSeconds = (Date.now() - startedAt) / 1000;

console.log(`Phase 13 dataset: ${report.dataset.id}`);
console.log(`Sanity: ${report.sanity.pass ? "PASS" : "FAIL"} (${report.sanity.seeds} seeds)`);
console.log(
  `Fixtures: ${report.methodology.fixtures.length} directional fixtures x ${report.methodology.seedsPerFixture} seeds`
);
console.log(
  `Aggregate: shots ${report.aggregate.averages.shots.toFixed(2)}, goals ${report.aggregate.averages.goals.toFixed(
    2
  )}, fouls ${report.aggregate.averages.fouls.toFixed(2)}, cards ${report.aggregate.averages.cards.toFixed(
    2
  )}, corners ${report.aggregate.averages.corners.toFixed(2)}`
);
console.log(
  `Shot supply: chance ${report.aggregate.ratios.chanceShotsSharePct.toFixed(
    1
  )}%, set-piece ${report.aggregate.ratios.setPieceShotsSharePct.toFixed(
    1
  )}%, carrier ${report.aggregate.ratios.openPlayCarrierShotsSharePct.toFixed(1)}%`
);
console.log(`Elapsed: ${elapsedSeconds.toFixed(1)}s`);
console.log(report.synthesis.recommendation);

function parseArgs(args: string[]): {
  outputPath?: string;
  seedsPerFixture?: number;
  sanitySeeds?: number;
  databasePath?: string;
} {
  const options: {
    outputPath?: string;
    seedsPerFixture?: number;
    sanitySeeds?: number;
    databasePath?: string;
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

