import { describe, expect, it } from "vitest";

import { runPhase15ModulationDiagnostics } from "../../src/fc25/phase15ModulationDiagnostics";

describe("Phase 15 modulation diagnostics", () => {
  it("shows A5 compresses score-state shoot headroom versus Phase 8", () => {
    const report = runPhase15ModulationDiagnostics();
    const phase8 = headroom(report, "phase8", "shoot");
    const a5 = headroom(report, "a5", "shoot");

    expect(a5).toBeLessThan(phase8);
  });

  it("shows alpha recovers some A5 shoot headroom without changing tackle headroom", () => {
    const report = runPhase15ModulationDiagnostics();
    const a5Shoot = headroom(report, "a5", "shoot");
    const alphaShoot = headroom(report, "alpha", "shoot");
    const a5Tackle = headroom(report, "a5", "tackle");
    const alphaTackle = headroom(report, "alpha", "tackle");

    expect(alphaShoot).toBeGreaterThan(a5Shoot);
    expect(alphaTackle).toBe(a5Tackle);
  });
});

function headroom(
  report: ReturnType<typeof runPhase15ModulationDiagnostics>,
  config: "phase8" | "a5" | "alpha",
  mechanism: "shoot" | "pass" | "dribble" | "tackle"
): number {
  const row = report.headroom.find((candidate) => candidate.config === config && candidate.mechanism === mechanism);
  if (!row) {
    throw new Error(`Missing ${config} ${mechanism} row`);
  }
  return row.headroom;
}
