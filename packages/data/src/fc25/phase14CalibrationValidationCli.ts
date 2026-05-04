import { execSync } from "node:child_process";

import { runPhase14CalibrationValidation } from "./phase14CalibrationValidation";

const report = runPhase14CalibrationValidation({
  ...parseArgs(process.argv.slice(2)),
  gitSha: currentGitSha()
});

console.log(
  `Phase 14 validation: ${report.synthesis.readyToLock ? "PASS" : "FAIL"} (${report.pl20.synthesis.totalRuns} PL20 runs)`
);
for (const row of report.classifications) {
  console.log(
    `${row.metric}: ${row.value.toFixed(2)} target ${row.band[0]}-${row.band[1]} ${row.pass ? "PASS" : "FAIL"}`
  );
}
console.log(`Responsiveness: ${report.responsiveness.pass ? "PASS" : "FAIL"}`);
console.log(`Side-switch: ${report.sideSwitch.pass ? "PASS" : "FAIL"}`);

if (!report.synthesis.readyToLock) {
  process.exitCode = 2;
}

function parseArgs(args: string[]) {
  const options: {
    outputPath?: string;
    pl20SeedsPerFixture?: number;
    pl20FixtureLimit?: number;
    responsivenessSeeds?: number;
    manualXiSeeds?: number;
    sideSwitchSeeds?: number;
    sanitySeeds?: number;
    databasePath?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--output" && next) {
      options.outputPath = next;
      index += 1;
    } else if (arg === "--pl20-seeds" && next) {
      options.pl20SeedsPerFixture = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--pl20-fixture-limit" && next) {
      options.pl20FixtureLimit = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--responsiveness-seeds" && next) {
      options.responsivenessSeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--manual-xi-seeds" && next) {
      options.manualXiSeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--side-switch-seeds" && next) {
      options.sideSwitchSeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--sanity-seeds" && next) {
      options.sanitySeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--database" && next) {
      options.databasePath = next;
      index += 1;
    } else if (arg !== undefined) {
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
