import { describe, expect, it } from "vitest";

import { simulateMatch } from "../../src";
import { createTestConfig } from "../helpers";

describe("simulateMatch", () => {
  it("simulates a deterministic 900-tick second half", () => {
    const first = simulateMatch(createTestConfig(99));
    const second = simulateMatch(createTestConfig(99));

    expect(first).toEqual(second);
    expect(first.ticks).toHaveLength(900);
    expect(first.ticks[0]?.matchClock).toEqual({ half: 2, minute: 45, seconds: 3 });
    expect(first.ticks.at(-1)?.matchClock).toEqual({ half: 2, minute: 90, seconds: 0 });
    expect(first.finalSummary.finalScore.home).toBeGreaterThanOrEqual(0);
    expect(first.finalSummary.finalScore.away).toBeGreaterThanOrEqual(3);
  });
});
