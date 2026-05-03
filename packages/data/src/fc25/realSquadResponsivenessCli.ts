import { runRealSquadResponsiveness } from "./realSquadResponsiveness";

const options = parseArgs(process.argv.slice(2));
const report = runRealSquadResponsiveness(options);

for (const comparison of report.comparisons) {
  console.log(
    `${comparison.name}: ${comparison.deltaPct.toFixed(2)}% ${comparison.status} ` +
      `(${comparison.baselineAverage.toFixed(2)} -> ${comparison.variantAverage.toFixed(2)})`
  );
}
console.log(`Pass: ${report.pass ? "yes" : "no"}`);

if (!report.pass) {
  process.exitCode = 1;
}

function parseArgs(args: string[]): { csvPath?: string; seeds?: number; outputPath?: string } {
  const options: { csvPath?: string; seeds?: number; outputPath?: string } = {};
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
    } else {
      throw new Error(`Unknown or incomplete option '${arg}'`);
    }
  }
  return options;
}
