import { runRealSquadResponsiveness } from "./realSquadResponsiveness";

const options = parseArgs(process.argv.slice(2));
const report = runRealSquadResponsiveness(options);

for (const comparison of report.comparisons) {
  console.log(
    `${comparison.name}: ${comparison.deltaPct.toFixed(2)}% ${comparison.status} ` +
      `(${comparison.baselineAverage.toFixed(2)} -> ${comparison.variantAverage.toFixed(2)})`
  );
}
console.log(
  `Fatigue impact: ${report.phase5.fatigueImpact.deltaPct.toFixed(2)}% ${report.phase5.fatigueImpact.status} ` +
    `(${report.phase5.fatigueImpact.baselineAverage.toFixed(2)} -> ${report.phase5.fatigueImpact.variantAverage.toFixed(2)})`
);
console.log(
  `Score-state impact: ${report.phase5.scoreStateImpact.deltaPct.toFixed(2)}% ${report.phase5.scoreStateImpact.status} ` +
    `(${report.phase5.scoreStateImpact.baselineAverage.toFixed(2)} -> ${report.phase5.scoreStateImpact.variantAverage.toFixed(2)})`
);
console.log(
  `Score-state diagnostics: urgency ${report.phase5.scoreStateDiagnostics.baseline.final15AverageUrgency.toFixed(2)} -> ` +
    `${report.phase5.scoreStateDiagnostics.variant.final15AverageUrgency.toFixed(2)}, ` +
    `shots ${report.phase5.scoreStateDiagnostics.baseline.final15Shots.toFixed(2)} -> ` +
    `${report.phase5.scoreStateDiagnostics.variant.final15Shots.toFixed(2)}, ` +
    `possession ticks ${report.phase5.scoreStateDiagnostics.baseline.final15PossessionTicks.toFixed(2)} -> ` +
    `${report.phase5.scoreStateDiagnostics.variant.final15PossessionTicks.toFixed(2)}`
);
console.log(
  `Auto Subs impact: ${report.phase5.subImpact.status}; shifted metrics ${report.phase5.subImpact.shiftedMetrics.length}`
);
if (report.phase5.subImpact.substitutionDiagnostics) {
  const diagnostics = report.phase5.subImpact.substitutionDiagnostics;
  console.log(
    `Auto Subs diagnostics: avg ${diagnostics.averageTotalSubs.toFixed(2)} total, ` +
      `${diagnostics.averageHomeSubs.toFixed(2)} home, ${diagnostics.averageAwaySubs.toFixed(2)} away; ` +
      `${diagnostics.zeroSubMatches} zero-sub matches; max ${diagnostics.maxSubsInMatch}`
  );
}
console.log(
  `Chance creation impact: ${report.phase6.chanceCreationImpact.deltaPct.toFixed(2)}% ${report.phase6.chanceCreationImpact.status} ` +
    `(${report.phase6.chanceCreationImpact.baselineAverage.toFixed(2)} -> ${report.phase6.chanceCreationImpact.variantAverage.toFixed(2)})`
);
console.log(
  `Score-state shot impact: ${report.phase6.scoreStateShotImpact.deltaPct.toFixed(2)}% ${report.phase6.scoreStateShotImpact.status} ` +
    `(${report.phase6.scoreStateShotImpact.baselineAverage.toFixed(2)} -> ${report.phase6.scoreStateShotImpact.variantAverage.toFixed(2)})`
);
console.log(
  `Set-piece baseline: ${report.phase6.setPieceImpact.averageSetPieceEvents.toFixed(2)} events, ` +
    `${report.phase6.setPieceImpact.averageSetPieceGoals.toFixed(2)} goals, ` +
    `${report.phase6.setPieceImpact.averageCorners.toFixed(2)} corners, ` +
    `${report.phase6.setPieceImpact.averagePenalties.toFixed(2)} penalties, ` +
    `${report.phase6.setPieceImpact.penaltyConversionPct.toFixed(1)}% penalty conversion`
);
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
