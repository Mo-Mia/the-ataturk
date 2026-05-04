import { execSync } from "node:child_process";

import { runFc26CalibrationBaseline } from "./fc26CalibrationBaseline";

const report = runFc26CalibrationBaseline({
  ...parseArgs(process.argv.slice(2)),
  gitSha: currentGitSha()
});

console.log(`FC26 baseline dataset: ${report.dataset.id}`);
console.log(`Sanity: ${report.sanity.pass ? "PASS" : "FAIL"} (${report.sanity.seeds} seeds)`);
for (const row of report.characterisation) {
  console.log(
    `${row.duration}: shots ${row.metrics.shots.toFixed(2)}, goals ${row.metrics.goals.toFixed(
      2
    )}, fouls ${row.metrics.fouls.toFixed(2)}, cards ${row.metrics.cards.toFixed(2)}`
  );
}
for (const row of report.responsiveness) {
  const effect = row.deltaPct === null ? "activation" : `${row.deltaPct.toFixed(2)}%`;
  console.log(
    `${row.name}: ${effect} ${row.status} (${row.baselineAverage.toFixed(3)} -> ${row.variantAverage.toFixed(3)})`
  );
}
console.log(
  `Manual XI: ${report.manualXi.deltaPct.toFixed(2)}%, SE ${report.manualXi.standardErrorPct.toFixed(
    2
  )}pp`
);
console.log(
  `Buckets: ${report.synthesis.bucket1}/${report.synthesis.bucket2}/${report.synthesis.bucket3}`
);
console.log(report.synthesis.recommendation);

if (report.synthesis.bucket3 > 0) {
  process.exitCode = 2;
}

function parseArgs(args: string[]): {
  outputPath?: string;
  characterisationSeeds?: number;
  responsivenessSeeds?: number;
  manualXiSeeds?: number;
  sanitySeeds?: number;
  databasePath?: string;
} {
  const options: {
    outputPath?: string;
    characterisationSeeds?: number;
    responsivenessSeeds?: number;
    manualXiSeeds?: number;
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
    } else if (arg === "--characterisation-seeds" && next) {
      options.characterisationSeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--responsiveness-seeds" && next) {
      options.responsivenessSeeds = positiveInteger(next, arg);
      index += 1;
    } else if (arg === "--manual-xi-seeds" && next) {
      options.manualXiSeeds = positiveInteger(next, arg);
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
