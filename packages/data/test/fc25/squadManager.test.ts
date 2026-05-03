import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  applySquadManagerSuggestions,
  getActiveFc25DatasetVersion,
  importFc25Dataset,
  loadFc25Squad
} from "../../src/fc25";
import { migrate } from "../../src/migrate";
import { createTestDatabase, type TestDatabase } from "../test-db";

const FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("FC25 squad manager suggestions", () => {
  it("applies accepted suggestions into a new active dataset version only", () => {
    testDatabase = createFc25Database("squad-manager-apply");

    const base = loadFc25Squad("liverpool", "fc25-base", { include: "all" });
    const salah = base.players.find((player) => player.name === "Mohamed Salah");
    const reserve = base.players.at(-1);

    expect(salah).toBeDefined();
    expect(reserve).toBeDefined();

    const result = applySquadManagerSuggestions({
      clubId: "liverpool",
      baseDatasetVersionId: "fc25-base",
      now: new Date("2026-05-03T10:00:00.000Z"),
      suggestions: [
        {
          suggestionId: "sug-update",
          type: "player_update",
          playerId: salah!.id,
          changes: { name: "Mohamed Salah Hamed Mahrous Ghaly", position: "RW", age: 33 }
        },
        {
          suggestionId: "sug-add",
          type: "player_addition",
          livePlayer: {
            id: 999001,
            name: "New Forward",
            position: "Forward",
            dateOfBirth: "2000-01-01",
            nationality: "England",
            shirtNumber: 99
          },
          proposed: {
            name: "New Forward",
            position: "ST",
            nationality: "England",
            age: 26,
            shirtNumber: 99
          }
        },
        {
          suggestionId: "sug-remove",
          type: "player_removal",
          playerId: reserve!.id
        }
      ]
    });

    expect(result.summary).toEqual({ applied: 3, updated: 1, added: 1, removed: 1 });
    expect(getActiveFc25DatasetVersion()?.id).toBe(result.newDatasetVersionId);

    const db = new Database(testDatabase.path);
    try {
      expect(
        db
          .prepare<[string, string], { name: string; age: number }>(
            "SELECT name, age FROM fc25_players WHERE dataset_version_id = ? AND id = ?"
          )
          .get("fc25-base", salah!.id)
      ).toMatchObject({ name: "Mohamed Salah" });
      expect(
        db
          .prepare<[string, string], { name: string; age: number }>(
            "SELECT name, age FROM fc25_players WHERE dataset_version_id = ? AND id = ?"
          )
          .get(result.newDatasetVersionId, salah!.id)
      ).toMatchObject({ name: "Mohamed Salah Hamed Mahrous Ghaly", age: 33 });
      expect(
        db
          .prepare<[string], { count: number }>(
            "SELECT COUNT(*) AS count FROM fc25_players WHERE dataset_version_id = ? AND id = 'fd-999001'"
          )
          .get(result.newDatasetVersionId)?.count
      ).toBe(1);
      expect(
        db
          .prepare<[string, string], { squad_role: string }>(
            "SELECT squad_role FROM fc25_squads WHERE dataset_version_id = ? AND player_id = ?"
          )
          .get(result.newDatasetVersionId, reserve!.id)
      ).toMatchObject({ squad_role: "reserve" });
    } finally {
      db.close();
    }
  });

  it("rolls back the new version when a suggestion is invalid", () => {
    testDatabase = createFc25Database("squad-manager-rollback");

    expect(() =>
      applySquadManagerSuggestions({
        clubId: "liverpool",
        baseDatasetVersionId: "fc25-base",
        now: new Date("2026-05-03T10:00:00.000Z"),
        suggestions: [
          {
            suggestionId: "sug-bad",
            type: "player_update",
            playerId: "missing-player",
            changes: { name: "Missing Player" }
          }
        ]
      })
    ).toThrow(/missing-player/);

    const db = new Database(testDatabase.path);
    try {
      expect(
        db
          .prepare<[], { count: number }>(
            "SELECT COUNT(*) AS count FROM fc25_dataset_versions WHERE id LIKE 'fc25-squad-manager-%'"
          )
          .get()?.count
      ).toBe(0);
      expect(getActiveFc25DatasetVersion()?.id).toBe("fc25-base");
    } finally {
      db.close();
    }
  });
});

function createFc25Database(prefix: string): TestDatabase {
  const database = createTestDatabase(prefix);
  migrate({ databasePath: database.path });
  importFc25Dataset({
    databasePath: database.path,
    csvPath: FIXTURE_PATH,
    datasetVersionId: "fc25-base",
    name: "FC25 base",
    now: new Date("2026-05-03T09:00:00.000Z")
  });
  return database;
}
