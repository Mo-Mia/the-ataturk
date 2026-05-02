import { afterEach, describe, expect, it } from "vitest";

import {
  createMatchRuns,
  deleteMatchRun,
  getMatchRun,
  listMatchRuns,
  listMatchRunsByBatch
} from "../src/match-runs";
import { getDb } from "../src/db";
import { migrate } from "../src/migrate";
import type { CreateMatchRunInput } from "../src/types";
import { createTestDatabase, type TestDatabase } from "./test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("match run persistence", () => {
  it("creates and reads match runs with JSON payloads", () => {
    testDatabase = createTestDatabase("match-runs-create");
    migrate({ databasePath: testDatabase.path });
    const db = getDb(testDatabase.path);
    const run = createRun({ id: "run-a", seed: 10, artefact_filename: "run-a.json" });

    const [created] = createMatchRuns([run], db);

    expect(created).toEqual({ ...run, batch_id: null });
    expect(getMatchRun("run-a", db)).toEqual({ ...run, batch_id: null });
  });

  it("paginates runs newest-first", () => {
    testDatabase = createTestDatabase("match-runs-page");
    migrate({ databasePath: testDatabase.path });
    const db = getDb(testDatabase.path);
    createMatchRuns(
      [
        createRun({
          id: "old",
          created_at: "2026-05-02T10:00:00.000Z",
          artefact_filename: "old.json"
        }),
        createRun({
          id: "middle",
          created_at: "2026-05-02T11:00:00.000Z",
          artefact_filename: "middle.json"
        }),
        createRun({
          id: "new",
          created_at: "2026-05-02T12:00:00.000Z",
          artefact_filename: "new.json"
        })
      ],
      db
    );

    const page = listMatchRuns({ page: 1, limit: 2 }, db);

    expect(page.total).toBe(3);
    expect(page.hasMore).toBe(true);
    expect(page.runs.map((run) => run.id)).toEqual(["new", "middle"]);
  });

  it("lists runs by batch and deletes rows idempotently", () => {
    testDatabase = createTestDatabase("match-runs-batch-delete");
    migrate({ databasePath: testDatabase.path });
    const db = getDb(testDatabase.path);
    createMatchRuns(
      [
        createRun({ id: "run-2", batch_id: "batch-a", seed: 2, artefact_filename: "run-2.json" }),
        createRun({ id: "run-1", batch_id: "batch-a", seed: 1, artefact_filename: "run-1.json" })
      ],
      db
    );

    expect(listMatchRunsByBatch("batch-a", db).map((run) => run.seed)).toEqual([1, 2]);
    expect(deleteMatchRun("run-1", db)?.id).toBe("run-1");
    expect(deleteMatchRun("run-1", db)).toBeNull();
    expect(getMatchRun("run-1", db)).toBeNull();
  });
});

function createRun(overrides: Partial<CreateMatchRunInput>): CreateMatchRunInput {
  return {
    id: "run-id",
    created_at: "2026-05-02T12:00:00.000Z",
    batch_id: null,
    seed: 1,
    home_club_id: "liverpool",
    away_club_id: "manchester-city",
    home_tactics: { formation: "4-4-2", mentality: "balanced" },
    away_tactics: { formation: "4-4-2", mentality: "balanced" },
    summary: {
      score: { home: 1, away: 0 },
      shots: { home: 9, away: 4 },
      fouls: { home: 3, away: 2 },
      cards: { home: 1, away: 0 },
      possession: { home: 51, away: 49 }
    },
    artefact_filename: "run.json",
    ...overrides
  };
}
