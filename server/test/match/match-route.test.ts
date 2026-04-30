import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "../admin/test-db";
import { TEST_DERIVED_DATASET_VERSION, setupTestDerivedDataset } from "./test-derived-dataset";

interface SseEvent {
  event: string;
  data: unknown;
}

interface FinalEventData {
  iterations: number;
  finalClock: {
    half: 2;
    minute: number;
    seconds: number;
  };
  finalScore: {
    home: number;
    away: number;
  };
}

let testDatabase: TestDatabase | undefined;

beforeEach(() => {
  vi.spyOn(Math, "random").mockImplementation(createSeededRandom(15));
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

function parseSse(body: string): SseEvent[] {
  return body
    .trim()
    .split("\n\n")
    .map((frame) => {
      const event = frame
        .split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice("event: ".length);
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);

      if (!event || !data) {
        throw new Error(`Invalid SSE frame: ${frame}`);
      }

      return { event, data: JSON.parse(data) as unknown };
    });
}

describe("match route", () => {
  it("streams a full fast-forward second half", async () => {
    testDatabase = createServerTestDatabase("match-route");
    setupTestDerivedDataset(testDatabase.path);
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/match/run?speed=fast",
        payload: {
          fixture_id: "final-2005",
          dataset_version: TEST_DERIVED_DATASET_VERSION
        }
      });
      const events = parseSse(response.body);
      const tickEvents = events.filter((event) => event.event === "tick");
      const finalEvent = events.find((event) => event.event === "final");

      expect(response.statusCode).toBe(200);
      expect(tickEvents).toHaveLength(451);
      expect(finalEvent).toBeDefined();
      expect(finalEvent?.data).toMatchObject({
        iterations: 450,
        finalClock: {
          half: 2,
          minute: 90,
          seconds: 0
        }
      } satisfies Partial<FinalEventData>);
    } finally {
      await app.close();
    }
  });
});
