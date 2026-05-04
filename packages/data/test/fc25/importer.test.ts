import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";

import {
  getActiveFc25DatasetVersion,
  importFc25Dataset,
  listFc25Clubs,
  loadFc25Squad,
  parseFc25ImportCliArgs
} from "../../src/fc25";
import { migrate } from "../../src/migrate";
import { createTestDatabase, type TestDatabase } from "../test-db";

const FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("FC25 importer", () => {
  it("imports the five-club fixture as a new active dataset version", () => {
    testDatabase = createMigratedDatabase("fc25-import");

    const result = importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-test-v1",
      name: "FC25 test fixture",
      now: new Date("2026-05-02T12:00:00.000Z")
    });

    expect(result).toMatchObject({
      datasetVersionId: "fc25-test-v1",
      clubs: 5,
      players: 123,
      squads: 123
    });

    const db = new Database(testDatabase.path);
    try {
      expect(countRows(db, "fc25_dataset_versions")).toBe(1);
      expect(countRows(db, "fc25_clubs")).toBe(5);
      expect(countRows(db, "fc25_players")).toBe(123);
      expect(countRows(db, "fc25_squads")).toBe(123);
      expect(countRows(db, "fc25_squads WHERE squad_role = 'starter'")).toBe(55);
      expect(countRows(db, "fc25_squads WHERE squad_role = 'sub'")).toBe(35);
      expect(countRows(db, "fc25_squads WHERE squad_role = 'reserve'")).toBe(33);
    } finally {
      db.close();
    }

    const activeVersion = getActiveFc25DatasetVersion();
    expect(activeVersion?.id).toBe("fc25-test-v1");
    expect(activeVersion?.is_active).toBe(true);
    expect(listFc25Clubs().map((club) => club.id)).toEqual([
      "arsenal",
      "aston-villa",
      "liverpool",
      "manchester-city",
      "manchester-united"
    ]);
  });

  it("re-imports the same CSV as a separate version without mutating the previous one", () => {
    testDatabase = createMigratedDatabase("fc25-reimport");

    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-test-v1",
      now: new Date("2026-05-02T12:00:00.000Z")
    });
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-test-v2",
      now: new Date("2026-05-02T12:01:00.000Z")
    });

    const db = new Database(testDatabase.path);
    try {
      expect(countRows(db, "fc25_dataset_versions")).toBe(2);
      expect(countRows(db, "fc25_dataset_versions WHERE is_active = 1")).toBe(1);
      expect(countRows(db, "fc25_players WHERE dataset_version_id = 'fc25-test-v1'")).toBe(123);
      expect(countRows(db, "fc25_players WHERE dataset_version_id = 'fc25-test-v2'")).toBe(123);
    } finally {
      db.close();
    }

    expect(getActiveFc25DatasetVersion()?.id).toBe("fc25-test-v2");
  });

  it("loads the formation-neutral starter XI by default and full squad on request", () => {
    testDatabase = createMigratedDatabase("fc25-squad");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-test-v1"
    });

    const starters = loadFc25Squad("liverpool", "fc25-test-v1");
    const fullSquad = loadFc25Squad("liverpool", "fc25-test-v1", { include: "all" });

    expect(starters.players).toHaveLength(11);
    expect(fullSquad.players).toHaveLength(23);
    expect(starters.players.find((player) => player.name === "Mohamed Salah")).toMatchObject({
      name: "Mohamed Salah",
      overall: 89,
      sourcePosition: "RW",
      alternativePositions: ["RM"],
      preferredFoot: "left",
      position: "RW"
    });
    expect(starters.players.some((player) => player.name === "Alisson")).toBe(true);
    expect(starters.players.find((player) => player.name === "Alisson")?.gkAttributes).toEqual({
      gkDiving: 86,
      gkHandling: 85,
      gkKicking: 85,
      gkPositioning: 90,
      gkReflexes: 89
    });
  });

  it("parses CLI options for the import command", () => {
    expect(
      parseFc25ImportCliArgs([
        "--csv",
        FIXTURE_PATH,
        "--database",
        "/tmp/fc25.sqlite",
        "--name",
        "Fixture import",
        "--version-id",
        "fc25-fixture",
        "--format",
        "fc26",
        "--cap",
        "22"
      ])
    ).toEqual({
      csvPath: FIXTURE_PATH,
      databasePath: "/tmp/fc25.sqlite",
      name: "Fixture import",
      datasetVersionId: "fc25-fixture",
      format: "fc26",
      squadCap: 22
    });
  });
});

function createMigratedDatabase(prefix: string): TestDatabase {
  const database = createTestDatabase(prefix);
  migrate({ databasePath: database.path });
  return database;
}

function countRows(db: Database.Database, tableExpression: string): number {
  const row = db.prepare<[], { count: number }>(`SELECT COUNT(*) AS count FROM ${tableExpression}`).get();
  return row?.count ?? 0;
}
