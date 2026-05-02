import { createMatchRuns, getDb, importFc25Dataset } from "@the-ataturk/data";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import { writeVisualiserArtifact } from "../../src/routes/visualiser-artifacts";
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
    const createdRunIds: string[] = [];

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
          id: string;
          seed: number;
          batchId: string | null;
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
      createdRunIds.push(...body.runs.map((run) => run.id));
      expect(body.runs[0]?.id).toEqual(expect.any(String));
      expect(body.runs[0]?.batchId).toBeNull();
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

      const persisted = await app.inject({
        method: "GET",
        url: `/api/match-engine/runs/${body.runs[0]?.id}`
      });

      expect(persisted.statusCode).toBe(200);
      expect(persisted.json()).toMatchObject({
        id: body.runs[0]?.id,
        batchId: null,
        seed: 7,
        artefactId: body.runs[0]?.artefactId
      });
    } finally {
      for (const runId of createdRunIds) {
        await app.inject({ method: "DELETE", url: `/api/match-engine/runs/${runId}` });
      }
      await app.close();
    }
  });

  it("persists batch runs with a shared batch id", async () => {
    testDatabase = createServerTestDatabase("match-engine-batch");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-route-test"
    });
    const app = buildApp();
    const createdRunIds: string[] = [];

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/match-engine/simulate",
        payload: {
          home: { clubId: "liverpool", tactics: DEFAULT_TACTICS },
          away: { clubId: "manchester-city", tactics: DEFAULT_TACTICS },
          seed: 100,
          batch: 50
        }
      });
      const body = response.json<{
        runs: Array<{ id: string; seed: number; batchId: string | null; artefactId: string }>;
        errors: Array<{ seed: number; error: string }>;
      }>();

      expect(response.statusCode).toBe(200);
      expect(body.errors).toEqual([]);
      expect(body.runs).toHaveLength(50);
      createdRunIds.push(...body.runs.map((run) => run.id));
      const batchId = body.runs[0]?.batchId;
      expect(batchId).toEqual(expect.any(String));
      expect(body.runs.every((run) => run.batchId === batchId)).toBe(true);

      const batch = await app.inject({
        method: "GET",
        url: `/api/match-engine/batches/${batchId}/runs`
      });

      expect(batch.statusCode).toBe(200);
      expect(batch.json<{ runs: unknown[] }>().runs).toHaveLength(50);
    } finally {
      for (const runId of createdRunIds) {
        await app.inject({ method: "DELETE", url: `/api/match-engine/runs/${runId}` });
      }
      await app.close();
    }
  }, 15_000);

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

  it("lists persisted runs with pagination, newest-first order, and orphan filtering", async () => {
    testDatabase = createServerTestDatabase("match-engine-runs-list");
    await writeVisualiserArtifact("phase2-list-old.json", JSON.stringify({ ok: true }));
    await writeVisualiserArtifact("phase2-list-new.json", JSON.stringify({ ok: true }));
    createMatchRuns(
      [
        createRun({
          id: "old-run",
          created_at: "2026-05-02T10:00:00.000Z",
          artefact_filename: "phase2-list-old.json"
        }),
        createRun({
          id: "orphan-run",
          created_at: "2026-05-02T11:00:00.000Z",
          artefact_filename: "phase2-list-missing.json"
        }),
        createRun({
          id: "new-run",
          created_at: "2026-05-02T12:00:00.000Z",
          artefact_filename: "phase2-list-new.json"
        })
      ],
      getDb(testDatabase.path)
    );
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/match-engine/runs?page=1&limit=1"
      });
      const body = response.json<{
        runs: Array<{ id: string }>;
        total: number;
        page: number;
        hasMore: boolean;
      }>();

      expect(response.statusCode).toBe(200);
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);
      expect(body.hasMore).toBe(true);
      expect(body.runs.map((run) => run.id)).toEqual(["new-run"]);
    } finally {
      await app.inject({ method: "DELETE", url: "/api/match-engine/runs/old-run" });
      await app.inject({ method: "DELETE", url: "/api/match-engine/runs/new-run" });
      await app.close();
    }
  });

  it("returns run detail, batch 404s, and run 404s", async () => {
    testDatabase = createServerTestDatabase("match-engine-run-detail");
    await writeVisualiserArtifact("phase2-detail.json", JSON.stringify({ ok: true }));
    createMatchRuns(
      [
        createRun({
          id: "detail-run",
          batch_id: "detail-batch",
          artefact_filename: "phase2-detail.json"
        })
      ],
      getDb(testDatabase.path)
    );
    const app = buildApp();

    try {
      const detail = await app.inject({ method: "GET", url: "/api/match-engine/runs/detail-run" });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toMatchObject({ id: "detail-run", batchId: "detail-batch" });

      const missingRun = await app.inject({ method: "GET", url: "/api/match-engine/runs/missing" });
      expect(missingRun.statusCode).toBe(404);

      const missingBatch = await app.inject({
        method: "GET",
        url: "/api/match-engine/batches/missing/runs"
      });
      expect(missingBatch.statusCode).toBe(404);
    } finally {
      await app.inject({ method: "DELETE", url: "/api/match-engine/runs/detail-run" });
      await app.close();
    }
  });

  it("deletes the row and artifact file, and repeated deletes are idempotent", async () => {
    testDatabase = createServerTestDatabase("match-engine-delete");
    await writeVisualiserArtifact("phase2-delete.json", JSON.stringify({ ok: true }));
    createMatchRuns(
      [createRun({ id: "delete-run", artefact_filename: "phase2-delete.json" })],
      getDb(testDatabase.path)
    );
    const app = buildApp();

    try {
      const first = await app.inject({ method: "DELETE", url: "/api/match-engine/runs/delete-run" });
      expect(first.statusCode).toBe(204);

      const row = await app.inject({ method: "GET", url: "/api/match-engine/runs/delete-run" });
      expect(row.statusCode).toBe(404);

      const artifact = await app.inject({
        method: "GET",
        url: "/api/visualiser/artifacts/phase2-delete.json"
      });
      expect(artifact.statusCode).toBe(404);

      const second = await app.inject({ method: "DELETE", url: "/api/match-engine/runs/delete-run" });
      expect(second.statusCode).toBe(204);
    } finally {
      await app.close();
    }
  });
});

function createRun(overrides: {
  id: string;
  created_at?: string;
  batch_id?: string | null;
  artefact_filename: string;
}) {
  return {
    id: overrides.id,
    created_at: overrides.created_at ?? "2026-05-02T12:00:00.000Z",
    batch_id: overrides.batch_id ?? null,
    seed: 7,
    home_club_id: "liverpool" as const,
    away_club_id: "manchester-city" as const,
    home_tactics: DEFAULT_TACTICS,
    away_tactics: DEFAULT_TACTICS,
    summary: {
      score: { home: 1, away: 0 },
      shots: { home: 9, away: 5 },
      fouls: { home: 3, away: 2 },
      cards: { home: 1, away: 0 },
      possession: { home: 52, away: 48 }
    },
    artefact_filename: overrides.artefact_filename
  };
}
