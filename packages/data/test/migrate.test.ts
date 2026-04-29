import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import { migrate } from "../src/migrate";
import { createTestDatabase, type TestDatabase } from "./test-db";

interface CountRow {
  count: number;
}

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("data migrations", () => {
  it("applies migrations to a fresh DB and is idempotent on a second run", () => {
    testDatabase = createTestDatabase("migrate");

    const firstRun = migrate({ databasePath: testDatabase.path });
    const secondRun = migrate({ databasePath: testDatabase.path });

    expect(firstRun.applied).toEqual(["001_initial.sql", "002_player_profiles.sql"]);
    expect(firstRun.skipped).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual(["001_initial.sql", "002_player_profiles.sql"]);

    const db = new Database(testDatabase.path);
    try {
      const row = db
        .prepare<[], CountRow>("SELECT COUNT(*) AS count FROM _migrations")
        .get();

      expect(row?.count).toBe(2);
    } finally {
      db.close();
    }
  });
});
