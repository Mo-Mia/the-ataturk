import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildHalfTimeMatchState } from "../../src/match/half-time-state";
import { clockForIteration, iterateMatch } from "../../src/match/orchestrator";
import { createServerTestDatabase, type TestDatabase } from "../admin/test-db";
import { TEST_DERIVED_DATASET_VERSION, setupTestDerivedDataset } from "./test-derived-dataset";

let testDatabase: TestDatabase | undefined;

beforeEach(() => {
  vi.spyOn(Math, "random").mockImplementation(createSeededRandom(12));
});

afterEach(() => {
  vi.restoreAllMocks();
  testDatabase?.cleanup();
  testDatabase = undefined;
});

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("iterateMatch", () => {
  it("runs a complete second half with the real engine", async () => {
    testDatabase = createServerTestDatabase("orchestrator");
    setupTestDerivedDataset(testDatabase.path);

    const matchDetails = await buildHalfTimeMatchState(
      "liverpool",
      "ac-milan",
      TEST_DERIVED_DATASET_VERSION
    );
    const ticks = [];

    for await (const tick of iterateMatch(matchDetails, { iterationDelayMs: 0 })) {
      ticks.push(tick);
    }

    const finalTick = ticks.at(-1);

    expect(ticks).toHaveLength(451);
    expect(finalTick?.iteration).toBe(450);
    expect(finalTick?.matchClock).toEqual({ half: 2, minute: 90, seconds: 0 });
    expect(finalTick?.score.home.goals).toBeGreaterThanOrEqual(0);
    expect(finalTick?.score.home.goals).toBeLessThanOrEqual(6);
    expect(finalTick?.score.away.goals).toBeGreaterThanOrEqual(3);
    expect(finalTick?.score.away.goals).toBeLessThanOrEqual(9);
  });

  it("maps second-half iteration numbers to the match clock", () => {
    expect(clockForIteration(0)).toEqual({ half: 2, minute: 45, seconds: 0 });
    expect(clockForIteration(6)).toEqual({ half: 2, minute: 45, seconds: 36 });
    expect(clockForIteration(450)).toEqual({ half: 2, minute: 90, seconds: 0 });
  });
});
