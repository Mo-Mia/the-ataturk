import { describe, expect, it } from "vitest";

import { interpretStrandA, summariseGoalImpact } from "../../src";

describe("manual XI impact investigation helpers", () => {
  it("summarises paired goal impact and standard error", () => {
    const summary = summariseGoalImpact([
      { autoGoals: 2, rotatedGoals: 1 },
      { autoGoals: 1, rotatedGoals: 1 },
      { autoGoals: 3, rotatedGoals: 2 },
      { autoGoals: 2, rotatedGoals: 2 }
    ]);

    expect(summary.seeds).toBe(4);
    expect(summary.autoGoalsAverage).toBe(2);
    expect(summary.rotatedGoalsAverage).toBe(1.5);
    expect(summary.pairedGoalDeltaAverage).toBe(-0.5);
    expect(summary.impactPct).toBe(-25);
    expect(summary.impactMagnitudePct).toBe(25);
    expect(summary.pairedGoalDeltaStandardError).toBeCloseTo(0.2887, 4);
    expect(summary.impactStandardErrorPct).toBeCloseTo(14.4338, 4);
  });

  it("classifies strand A buckets from paired uncertainty and impact magnitude", () => {
    expect(
      interpretStrandA({
        ...baseSummary(),
        impactMagnitudePct: 14,
        impactStandardErrorPct: 2
      }).outcome
    ).toBe("sample_noise");
    expect(
      interpretStrandA({
        ...baseSummary(),
        impactMagnitudePct: 9,
        impactStandardErrorPct: 2
      }).outcome
    ).toBe("real_decay");
    expect(
      interpretStrandA({
        ...baseSummary(),
        impactMagnitudePct: 11,
        impactStandardErrorPct: 2
      }).outcome
    ).toBe("borderline");
    expect(
      interpretStrandA({
        ...baseSummary(),
        impactMagnitudePct: 9,
        impactStandardErrorPct: 5.5
      }).outcome
    ).toBe("wide_uncertainty");
    expect(
      interpretStrandA({
        ...baseSummary(),
        impactMagnitudePct: 19,
        impactStandardErrorPct: 2
      }).outcome
    ).toBe("dramatic_difference");
  });
});

function baseSummary() {
  return {
    seeds: 1000,
    autoGoalsAverage: 1,
    rotatedGoalsAverage: 0.9,
    pairedGoalDeltaAverage: -0.1,
    pairedGoalDeltaStandardError: 0.02,
    impactPct: -10,
    impactMagnitudePct: 10,
    impactStandardErrorPct: 2,
    confidenceInterval95Pct: [-13.92, -6.08] as [number, number]
  };
}
