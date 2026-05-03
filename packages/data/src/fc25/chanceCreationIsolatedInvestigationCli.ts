import { runChanceCreationIsolatedInvestigation } from "./chanceCreationIsolatedInvestigation";

const report = runChanceCreationIsolatedInvestigation(parseArgs(process.argv.slice(2)));

console.log(
  `Chance creation sanity: ${
    report.sanityCheck.pass ? "PASS" : "FAIL"
  } (${report.sanityCheck.chanceCreatedEventsWithChanceCreationOff} chance_created events with flag OFF across ${
    report.sanityCheck.seeds
  } seeds)`
);

for (const classification of report.classifications) {
  console.log(
    `${classification.protocol} ${classification.metric}: ${classification.effectPct.toFixed(
      2
    )}% (${classification.offAverage.toFixed(3)} -> ${classification.onAverage.toFixed(
      3
    )}), SE ${classification.effectStandardErrorPct.toFixed(2)}pp, ${
      classification.outcome
    }`
  );
}

if (!report.sanityCheck.pass) {
  process.exitCode = 1;
}

function parseArgs(args: string[]): {
  csvPath?: string;
  seeds?: number;
  sanitySeeds?: number;
  outputPath?: string;
} {
  const options: {
    csvPath?: string;
    seeds?: number;
    sanitySeeds?: number;
    outputPath?: string;
  } = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = args[index + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--csv" && next) {
      options.csvPath = next;
      index += 1;
    } else if ((arg === "--seeds" || arg === "-n") && next) {
      options.seeds = positiveInteger(next, "--seeds");
      index += 1;
    } else if (arg === "--sanity-seeds" && next) {
      options.sanitySeeds = positiveInteger(next, "--sanity-seeds");
      index += 1;
    } else if (arg === "--output" && next) {
      options.outputPath = next;
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
