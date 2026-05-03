import { describe, expect, it } from "vitest";

import {
  classifyMetric,
  summariseMetric
} from "../../src/fc25/chanceCreationIsolatedInvestigation";

describe("chance creation isolated investigation helpers", () => {
  it("summarises paired metric effect and standard error", () => {
    const summary = summariseMetric("final15HomeShots", [
      {
        off: metrics(1, 10),
        on: metrics(2, 12)
      },
      {
        off: metrics(1, 8),
        on: metrics(1, 8)
      },
      {
        off: metrics(2, 10),
        on: metrics(3, 12)
      }
    ]);

    expect(summary.offAverage).toBeCloseTo(1.333, 3);
    expect(summary.onAverage).toBeCloseTo(2, 3);
    expect(summary.pairedDeltaAverage).toBeCloseTo(0.667, 3);
    expect(summary.effectPct).toBeCloseTo(50, 3);
    expect(summary.pairedDeltaStandardError).toBeGreaterThan(0);
  });

  it("classifies near-zero, stable, and refactor-impact buckets", () => {
    expect(
      classifyMetric("exact_isolated", {
        metric: "overallTotalShots",
        offAverage: 10,
        onAverage: 10.25,
        pairedDeltaAverage: 0.25,
        pairedDeltaStandardError: 0.2,
        effectPct: 2.5,
        effectStandardErrorPct: 2,
        confidenceInterval95Pct: [0.1, 4.9]
      }).outcome
    ).toBe("Outcome 1");

    expect(
      classifyMetric("forced_deficit", {
        metric: "final15HomeShots",
        offAverage: 1,
        onAverage: 1.12,
        pairedDeltaAverage: 0.12,
        pairedDeltaStandardError: 0.02,
        effectPct: 12,
        effectStandardErrorPct: 2,
        confidenceInterval95Pct: [8.08, 15.92]
      }).outcome
    ).toBe("Outcome 2");

    expect(
      classifyMetric("exact_isolated", {
        metric: "final15HomeShots",
        offAverage: 1,
        onAverage: 1.2,
        pairedDeltaAverage: 0.2,
        pairedDeltaStandardError: 0.02,
        effectPct: 20,
        effectStandardErrorPct: 2,
        confidenceInterval95Pct: [16.08, 23.92]
      }).outcome
    ).toBe("Outcome 3");
  });
});

function metrics(final15HomeShots: number, overallTotalShots: number) {
  return {
    final15HomeShots,
    overallTotalShots,
    homeShots: overallTotalShots / 2,
    awayShots: overallTotalShots / 2,
    chanceCreatedEvents: 0,
    convertedChanceEvents: 0
  };
}
