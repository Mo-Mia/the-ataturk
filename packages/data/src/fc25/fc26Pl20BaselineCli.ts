import { execSync } from "node:child_process";

import { runFc26Pl20Baseline } from "./fc26Pl20Baseline";

const options = parseArgs(process.argv.slice(2));
const report = runFc26Pl20Baseline({
  ...options,
  gitSha: gitSha()
});

console.log(
  `FC26 PL20 baseline complete: ${report.synthesis.totalRuns} runs across ${report.synthesis.fixturesRun} fixtures`
);
console.log(
  `Aggregate: ${report.aggregate.metrics.totalShots.toFixed(2)} shots, ${report.aggregate.metrics.totalGoals.toFixed(
    2
  )} goals, ${report.aggregate.metrics.totalFouls.toFixed(2)} fouls, ${report.aggregate.metrics.corners.toFixed(
    2
  )} corners per match`
);

function parseArgs(args: string[]) {
  const parsed: {
    outputPath?: string;
    seedsPerFixture?: number;
    fixtureLimit?: number;
    sanitySeeds?: number;
    databasePath?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--output" && next) {
      parsed.outputPath = next;
      index += 1;
    } else if (arg === "--seeds" && next) {
      parsed.seedsPerFixture = integerArg(next, "--seeds");
      index += 1;
    } else if (arg === "--fixture-limit" && next) {
      parsed.fixtureLimit = integerArg(next, "--fixture-limit");
      index += 1;
    } else if (arg === "--sanity-seeds" && next) {
      parsed.sanitySeeds = integerArg(next, "--sanity-seeds");
      index += 1;
    } else if (arg === "--database" && next) {
      parsed.databasePath = next;
      index += 1;
    } else if (arg !== undefined) {
      throw new Error(`Unknown argument '${arg}'`);
    }
  }
  return parsed;
}

function integerArg(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}
