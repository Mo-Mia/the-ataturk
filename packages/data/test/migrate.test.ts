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

    expect(firstRun.applied).toEqual([
      "001_initial.sql",
      "002_player_profiles.sql",
      "003_fc25.sql",
      "004_match_runs.sql",
      "005_match_runs_side_switch_version.sql",
      "006_fc25_dataset_version_description.sql"
    ]);
    expect(firstRun.skipped).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([
      "001_initial.sql",
      "002_player_profiles.sql",
      "003_fc25.sql",
      "004_match_runs.sql",
      "005_match_runs_side_switch_version.sql",
      "006_fc25_dataset_version_description.sql"
    ]);

    const db = new Database(testDatabase.path);
    try {
      const row = db
        .prepare<[], CountRow>("SELECT COUNT(*) AS count FROM _migrations")
        .get();

      expect(row?.count).toBe(6);

      const tableRows = db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'fc25_%' ORDER BY name"
        )
        .all();

      expect(tableRows.map((table) => table.name)).toEqual([
        "fc25_clubs",
        "fc25_dataset_versions",
        "fc25_players",
        "fc25_squads"
      ]);

      const matchRunsTable = db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'match_runs'"
        )
        .get();

      expect(matchRunsTable?.name).toBe("match_runs");
    } finally {
      db.close();
    }
  });
});
