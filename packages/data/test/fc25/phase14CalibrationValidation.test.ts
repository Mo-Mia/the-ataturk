import { describe, expect, it } from "vitest";

import { classifyPhase14Metrics, PHASE14_REAL_PL_BANDS } from "../../src/fc25/phase14CalibrationValidation";
import type { Pl20FixtureMetrics } from "../../src/fc25/fc26Pl20Baseline";

describe("Phase 14 calibration validation", () => {
  it("classifies PL20 metrics against real-PL one-SD bands", () => {
    const classifications = classifyPhase14Metrics(metrics({ totalShots: 24.8, totalGoals: 2.75 }));

    expect(classifications.every((row) => row.pass)).toBe(true);
    expect(classifications.find((row) => row.metric === "totalShots")?.band).toEqual([
      PHASE14_REAL_PL_BANDS.totalShots.min,
      PHASE14_REAL_PL_BANDS.totalShots.max
    ]);
  });

  it("fails metrics outside the Phase 14 band", () => {
    const classifications = classifyPhase14Metrics(metrics({ totalShots: 10.42 }));

    expect(classifications.find((row) => row.metric === "totalShots")?.pass).toBe(false);
  });
});

function metrics(overrides: Partial<Pl20FixtureMetrics> = {}): Pl20FixtureMetrics {
  return {
    homeShots: 12,
    awayShots: 12,
    totalShots: 24,
    homeGoals: 1.3,
    awayGoals: 1.3,
    totalGoals: 2.6,
    homeFouls: 10,
    awayFouls: 10,
    totalFouls: 20,
    homeCards: 2,
    awayCards: 2,
    totalCards: 4,
    homePossession: 50,
    awayPossession: 50,
    corners: 10,
    directFreeKicks: 0,
    indirectFreeKicks: 20,
    penalties: 0.2,
    setPieceGoals: 0.3,
    saves: 2,
    cornersFromDeflectedShots: 3,
    cornersFromDefensiveClearances: 4,
    cornersFromSavedWide: 1,
    cornersFromBlockedDelivery: 2,
    wideDeliveryPasses: 12,
    failedWideDeliveryPasses: 5,
    ...overrides
  };
}
