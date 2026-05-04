import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
let tempDirectory: string | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
  if (tempDirectory) {
    rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = undefined;
  }
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

  it("imports full FC26 squads with shirt numbers and FC26 metadata", () => {
    testDatabase = createMigratedDatabase("fc26-import");
    const csvPath = writeTempCsv("fc26-import.csv", fc26FullSquadCsv());

    const result = importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath,
      format: "fc26",
      datasetVersionId: "fc26-test-v1",
      name: "FC26 test fixture"
    });

    expect(result).toMatchObject({
      datasetVersionId: "fc26-test-v1",
      clubs: 5,
      players: 128,
      squads: 128
    });

    const liverpool = loadFc25Squad("liverpool", "fc26-test-v1", { include: "all" }).players;
    expect(liverpool).toHaveLength(28);
    expect(liverpool.find((player) => player.name === "Giorgi Mamardashvili")).toMatchObject({
      squadNumber: 25,
      sourcePosition: "GK"
    });
    expect(liverpool.find((player) => player.name === "Jeremie Frimpong")).toMatchObject({
      squadNumber: 30,
      sourcePosition: "RB"
    });
    expect(liverpool.find((player) => player.name === "Florian Wirtz")).toMatchObject({
      squadNumber: 7,
      sourcePosition: "AM"
    });
    expect(liverpool.find((player) => player.name === "Alexander Isak")).toMatchObject({
      squadNumber: 9,
      sourcePosition: "ST"
    });
    expect(liverpool.find((player) => player.name === "Milos Kerkez")).toMatchObject({
      squadNumber: 6,
      sourcePosition: "LB"
    });
    expect(liverpool.find((player) => player.name === "Hugo Ekitike")).toMatchObject({
      squadNumber: 22,
      sourcePosition: "ST"
    });

    const db = new Database(testDatabase.path);
    try {
      const row = db
        .prepare<[], { value_eur: number; work_rate: string; position_ratings_json: string }>(
          "SELECT value_eur, work_rate, position_ratings_json FROM fc25_players WHERE dataset_version_id = 'fc26-test-v1' AND id = '256630'"
        )
        .get();

      expect(row).toMatchObject({
        value_eur: 132000000,
        work_rate: "High/Med"
      });
      expect(row?.position_ratings_json).toContain("\"cam\":89");
    } finally {
      db.close();
    }
  });

  it("warns but proceeds when an imported club exceeds 35 players", () => {
    testDatabase = createMigratedDatabase("fc26-warning");
    const csvPath = writeTempCsv(
      "fc26-warning.csv",
      fc26Csv([
        ...generatedClubRows("Arsenal", 36, 100000),
        ...generatedClubRows("Manchester City", 1, 200000),
        ...generatedClubRows("Manchester United", 1, 300000),
        ...generatedClubRows("Liverpool", 1, 400000),
        ...generatedClubRows("Aston Villa", 1, 500000)
      ])
    );
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    try {
      const result = importFc25Dataset({
        databasePath: testDatabase.path,
        csvPath,
        format: "fc26",
        datasetVersionId: "fc26-warning-v1"
      });

      expect(result.squads).toBe(40);
      expect(warnings).toEqual([
        "FC dataset import found 36 rows for Arsenal; expected a senior squad-sized group. Import will continue."
      ]);
    } finally {
      console.warn = originalWarn;
    }
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

function writeTempCsv(fileName: string, contents: string): string {
  tempDirectory ??= mkdtempSync(join(tmpdir(), "fc26-import-test-"));
  const csvPath = join(tempDirectory, fileName);
  writeFileSync(csvPath, contents, "utf8");
  return csvPath;
}

function fc26FullSquadCsv(): string {
  return fc26Csv([
    fc26Record({
      player_id: "262621",
      long_name: "Giorgi Mamardashvili",
      player_positions: "GK",
      overall: "84",
      club_name: "Liverpool",
      club_position: "SUB",
      club_jersey_number: "25"
    }),
    fc26Record({
      player_id: "253149",
      long_name: "Jeremie Frimpong",
      player_positions: "RB",
      overall: "83",
      club_name: "Liverpool",
      club_position: "RB",
      club_jersey_number: "30"
    }),
    fc26Record({
      player_id: "256630",
      long_name: "Florian Wirtz",
      player_positions: "CAM",
      overall: "89",
      value_eur: "132000000",
      work_rate: "High/Med",
      club_name: "Liverpool",
      club_position: "CAM",
      club_jersey_number: "7",
      cam: "89"
    }),
    fc26Record({
      player_id: "233731",
      long_name: "Alexander Isak",
      player_positions: "ST",
      overall: "88",
      club_name: "Liverpool",
      club_position: "SUB",
      club_jersey_number: "9"
    }),
    fc26Record({
      player_id: "260908",
      long_name: "Milos Kerkez",
      player_positions: "LB",
      overall: "82",
      club_name: "Liverpool",
      club_position: "LB",
      club_jersey_number: "6"
    }),
    fc26Record({
      player_id: "257289",
      long_name: "Hugo Ekitike",
      player_positions: "ST",
      overall: "83",
      club_name: "Liverpool",
      club_position: "ST",
      club_jersey_number: "22"
    }),
    ...generatedClubRows("Liverpool", 22, 260000),
    ...generatedClubRows("Manchester City", 26, 270000),
    ...generatedClubRows("Manchester United", 26, 280000),
    ...generatedClubRows("Arsenal", 24, 290000),
    ...generatedClubRows("Aston Villa", 24, 300000)
  ]);
}

function generatedClubRows(clubName: string, count: number, startId: number): Array<Record<string, string>> {
  return Array.from({ length: count }, (_, index) =>
    fc26Record({
      player_id: String(startId + index),
      long_name: `${clubName} Player ${index + 1}`,
      player_positions: index % 8 === 0 ? "GK" : "CM",
      overall: String(80 - (index % 12)),
      club_name: clubName,
      club_position: index < 11 ? "CM" : index < 18 ? "SUB" : "RES",
      club_jersey_number: String(index + 1)
    })
  );
}

function fc26Csv(rows: Array<Record<string, string>>): string {
  const headers = Object.keys(fc26Record());
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(","))
  ].join("\n");
}

function csvCell(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function fc26Record(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    player_id: "999999",
    player_url: "https://sofifa.com/player/999999/test-player/260001",
    fifa_version: "26",
    fifa_update: "1",
    fifa_update_date: "2025-09-21",
    short_name: "Test",
    long_name: "Test Player",
    player_positions: "CM",
    overall: "75",
    potential: "78",
    value_eur: "1000000",
    wage_eur: "20000",
    age: "24",
    dob: "2001-01-01",
    height_cm: "180",
    weight_kg: "75",
    league_id: "13",
    league_name: "Premier League",
    league_level: "1",
    club_team_id: "1",
    club_name: "Liverpool",
    club_position: "RES",
    club_jersey_number: "99",
    club_loaned_from: "",
    club_joined_date: "",
    club_contract_valid_until_year: "",
    nationality_id: "14",
    nationality_name: "England",
    nation_team_id: "",
    nation_position: "",
    nation_jersey_number: "",
    preferred_foot: "Right",
    weak_foot: "3",
    skill_moves: "3",
    international_reputation: "2",
    work_rate: "Med/Med",
    body_type: "Normal",
    real_face: "",
    release_clause_eur: "2000000",
    player_tags: "",
    player_traits: "",
    pace: "70",
    shooting: "70",
    passing: "70",
    dribbling: "70",
    defending: "70",
    physic: "70",
    attacking_crossing: "70",
    attacking_finishing: "70",
    attacking_heading_accuracy: "70",
    attacking_short_passing: "70",
    attacking_volleys: "70",
    skill_dribbling: "70",
    skill_curve: "70",
    skill_fk_accuracy: "70",
    skill_long_passing: "70",
    skill_ball_control: "70",
    movement_acceleration: "70",
    movement_sprint_speed: "70",
    movement_agility: "70",
    movement_reactions: "70",
    movement_balance: "70",
    power_shot_power: "70",
    power_jumping: "70",
    power_stamina: "70",
    power_strength: "70",
    power_long_shots: "70",
    mentality_aggression: "70",
    mentality_interceptions: "70",
    mentality_positioning: "70",
    mentality_vision: "70",
    mentality_penalties: "70",
    mentality_composure: "70",
    defending_marking_awareness: "70",
    defending_standing_tackle: "70",
    defending_sliding_tackle: "70",
    goalkeeping_diving: "70",
    goalkeeping_handling: "70",
    goalkeeping_kicking: "70",
    goalkeeping_positioning: "70",
    goalkeeping_reflexes: "70",
    goalkeeping_speed: "",
    ls: "70",
    st: "70",
    rs: "70",
    lw: "70",
    lf: "70",
    cf: "70",
    rf: "70",
    rw: "70",
    lam: "70",
    cam: "70",
    ram: "70",
    lm: "70",
    lcm: "70",
    cm: "70",
    rcm: "70",
    rm: "70",
    lwb: "70",
    ldm: "70",
    cdm: "70",
    rdm: "70",
    rwb: "70",
    lb: "70",
    lcb: "70",
    cb: "70",
    rcb: "70",
    rb: "70",
    gk: "70",
    player_face_url: "",
    ...overrides
  };
}

function createMigratedDatabase(prefix: string): TestDatabase {
  const database = createTestDatabase(prefix);
  migrate({ databasePath: database.path });
  return database;
}

function countRows(db: Database.Database, tableExpression: string): number {
  const row = db.prepare<[], { count: number }>(`SELECT COUNT(*) AS count FROM ${tableExpression}`).get();
  return row?.count ?? 0;
}
