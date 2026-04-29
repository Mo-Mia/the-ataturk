import { afterEach, describe, expect, it } from "vitest";

import { getDb } from "../src/db";
import { createMigratedSeededDatabase, type TestDatabase } from "./test-db";

interface CountRow {
  count: number;
}

let testDatabase: TestDatabase | undefined;

function count(sql: string): number {
  const row = getDb(testDatabase?.path).prepare<[], CountRow>(sql).get();
  return row?.count ?? 0;
}

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("data seed pipeline", () => {
  it("loads the v0.1 clubs, squads, final, active dataset version, and stub attributes", () => {
    testDatabase = createMigratedSeededDatabase("seed");

    expect(count("SELECT COUNT(*) AS count FROM clubs")).toBe(2);
    expect(count("SELECT COUNT(*) AS count FROM players")).toBe(49);
    expect(count("SELECT COUNT(*) AS count FROM players WHERE club_id = 'liverpool'")).toBe(26);
    expect(count("SELECT COUNT(*) AS count FROM players WHERE club_id = 'ac-milan'")).toBe(23);
    expect(count("SELECT COUNT(*) AS count FROM fixtures")).toBe(1);
    expect(count("SELECT COUNT(*) AS count FROM player_dataset_versions WHERE is_active = 1")).toBe(1);
    expect(count("SELECT COUNT(*) AS count FROM player_attributes WHERE dataset_version = 'v0-stub'")).toBe(49);
    expect(count("SELECT COUNT(*) AS count FROM players WHERE player_origin = 'real'")).toBe(49);
    expect(count("SELECT COUNT(*) AS count FROM players WHERE player_origin = 'user_created'")).toBe(0);
    expect(
      count(`
        SELECT COUNT(*) AS count
        FROM player_attributes
        WHERE passing + shooting + tackling + saving + agility + strength
          + penalty_taking + perception + jumping + control <> 0
      `)
    ).toBe(0);
  });
});
