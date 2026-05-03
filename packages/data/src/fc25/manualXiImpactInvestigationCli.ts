import {
  runManualXiImpactInvestigation,
  type InvestigationMode
} from "./manualXiImpactInvestigation";

const report = runManualXiImpactInvestigation(parseArgs(process.argv.slice(2)));

console.log(
  `Manual XI Strand A: ${report.strandA.impactPct.toFixed(2)}% ` +
    `(${report.strandA.autoGoalsAverage.toFixed(3)} -> ${report.strandA.rotatedGoalsAverage.toFixed(
      3
    )}), SE ${report.strandA.impactStandardErrorPct.toFixed(2)}pp`
);
console.log(`Strand A outcome: ${report.strandA.outcome} — ${report.strandA.interpretation}`);

if (report.decomposition) {
  console.log("Decomposition:");
  for (const row of report.decomposition) {
    console.log(
      `  ${row.label}: ${row.impactPct.toFixed(2)}%, SE ${row.impactStandardErrorPct.toFixed(
        2
      )}pp, restoration ${row.restorationFromAllOnPct?.toFixed(2)}pp`
    );
  }
}

if (report.classification) {
  console.log(`${report.classification.outcome}: ${report.classification.rationale}`);
  console.log(report.classification.phase8Readiness);
}

function parseArgs(args: string[]): {
  csvPath?: string;
  seeds?: number;
  outputPath?: string;
  mode?: InvestigationMode;
} {
  const options: {
    csvPath?: string;
    seeds?: number;
    outputPath?: string;
    mode?: InvestigationMode;
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
      options.seeds = Number(next);
      if (!Number.isInteger(options.seeds) || options.seeds <= 0) {
        throw new Error(`Invalid --seeds value '${next}'`);
      }
      index += 1;
    } else if (arg === "--output" && next) {
      options.outputPath = next;
      index += 1;
    } else if (arg === "--mode" && next) {
      options.mode = parseMode(next);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option '${arg}'`);
    }
  }
  return options;
}

function parseMode(value: string): InvestigationMode {
  if (value === "strand-a" || value === "decompose" || value === "all") {
    return value;
  }
  throw new Error("Expected --mode to be strand-a, decompose, or all");
}
