import { runPhase15ModulationDiagnostics } from "./phase15ModulationDiagnostics";

const report = runPhase15ModulationDiagnostics();

console.log("Phase 15 modulation diagnostics");
for (const row of report.headroom) {
  console.log(
    `${row.config} ${row.mechanism}: ${row.headroom.toFixed(4)} headroom (${row.minProbability.toFixed(
      4
    )} -> ${row.maxProbability.toFixed(4)})`
  );
}
console.log(report.synthesis.saturationMechanism);
console.log(report.synthesis.generalityFinding);
