import { importFc25Dataset } from "@the-ataturk/data";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "../admin/test-db";

const FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";
const DEFAULT_TACTICS = {
  formation: "4-4-2",
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("match-engine simulation routes", () => {
  it("returns an empty club list when no FC25 dataset is active", async () => {
    testDatabase = createServerTestDatabase("match-engine-empty-clubs");
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/match-engine/clubs"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("runs a second-half simulation and writes a visualiser artifact", async () => {
    testDatabase = createServerTestDatabase("match-engine-simulate");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-route-test"
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/match-engine/simulate",
        payload: {
          home: { clubId: "liverpool", tactics: DEFAULT_TACTICS },
          away: { clubId: "manchester-city", tactics: DEFAULT_TACTICS },
          seed: 7,
          batch: 1
        }
      });
      const body = response.json<{
        runs: Array<{
          seed: number;
          artefactId: string;
          summary: {
            score: { home: number; away: number };
            shots: { home: number; away: number };
            possession: { home: number; away: number };
          };
        }>;
        errors: Array<{ seed: number; error: string }>;
      }>();

      expect(response.statusCode).toBe(200);
      expect(body.errors).toEqual([]);
      expect(body.runs).toHaveLength(1);
      expect(body.runs[0]?.seed).toBe(7);
      expect(body.runs[0]?.artefactId).toMatch(
        /^match-engine-\d{14}-liv-mci-seed-7-[a-f0-9]{8}\.json$/
      );
      expect(body.runs[0]?.summary.shots.home).toEqual(expect.any(Number));

      const artifact = await app.inject({
        method: "GET",
        url: `/api/visualiser/artifacts/${body.runs[0]?.artefactId}`
      });
      const snapshot = artifact.json<{
        meta: {
          duration: string;
          preMatchScore: { home: number; away: number };
        };
        ticks: unknown[];
      }>();

      expect(artifact.statusCode).toBe(200);
      expect(snapshot.meta.duration).toBe("second_half");
      expect(snapshot.meta.preMatchScore).toEqual({ home: 0, away: 0 });
      expect(snapshot.ticks).toHaveLength(900);
    } finally {
      await app.close();
    }
  });

  it("rejects unknown FC25 clubs before running a batch", async () => {
    testDatabase = createServerTestDatabase("match-engine-unknown-club");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-route-test"
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/match-engine/simulate",
        payload: {
          home: { clubId: "chelsea", tactics: DEFAULT_TACTICS },
          away: { clubId: "liverpool", tactics: DEFAULT_TACTICS },
          seed: 7,
          batch: 1
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error:
          "home.clubId must be one of: arsenal, manchester-city, manchester-united, liverpool, aston-villa"
      });
    } finally {
      await app.close();
    }
  });
});
