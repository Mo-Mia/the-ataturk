import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { getDb, getDatabasePath, type SqliteDatabase } from "./db";
import { SEEDS_DIR } from "./paths";
import type {
  Club,
  DatasetVersion,
  Fixture,
  Player,
  PlayerAttributes,
  PlayerProfile,
  PlayerProfileVersion
} from "./types";

interface SeedResult {
  clubs: number;
  players: number;
  fixtures: number;
  datasetVersions: number;
  playerAttributes: number;
  profileVersions: number;
  playerProfiles: number;
}

type SeedDatasetVersion = DatasetVersion;
type SeedPlayer = Player;

const ZERO_ATTRIBUTES = {
  passing: 0,
  shooting: 0,
  tackling: 0,
  saving: 0,
  agility: 0,
  strength: 0,
  penalty_taking: 0,
  perception: 0,
  jumping: 0,
  control: 0
} as const;

const EMPTY_PROFILE_VERSION: PlayerProfileVersion = {
  id: "v0-empty",
  name: "Empty (Step 2A will populate via LLM extraction)",
  description: null,
  is_active: true,
  parent_version_id: null,
  created_at: "2026-04-29T00:00:00.000Z",
  updated_at: "2026-04-29T00:00:00.000Z"
};

export function seed(options: { databasePath?: string; seedsDir?: string } = {}): SeedResult {
  const db = getDb(options.databasePath);
  const seedsDir = options.seedsDir ?? SEEDS_DIR;
  const clubs = readJsonSeed<Club[]>(seedsDir, "clubs.json");
  const datasetVersions = readJsonSeed<SeedDatasetVersion[]>(seedsDir, "dataset-versions.json");
  const fixtures = readJsonSeed<Fixture[]>(seedsDir, "fixtures.json");
  const players = [
    ...readJsonSeed<SeedPlayer[]>(seedsDir, "players-liverpool.json"),
    ...readJsonSeed<SeedPlayer[]>(seedsDir, "players-milan.json")
  ];

  const reseed = db.transaction(() => {
    wipeSeededTables(db);
    insertClubs(db, clubs);
    insertDatasetVersions(db, datasetVersions);
    insertProfileVersions(db, [EMPTY_PROFILE_VERSION]);
    insertPlayers(db, players);
    insertFixtures(db, fixtures);
    insertStubAttributes(db, players, datasetVersions);
    insertEmptyProfiles(db, players, EMPTY_PROFILE_VERSION);
  });

  reseed();

  return {
    clubs: clubs.length,
    players: players.length,
    fixtures: fixtures.length,
    datasetVersions: datasetVersions.length,
    playerAttributes: players.length,
    profileVersions: 1,
    playerProfiles: players.filter((player) => player.player_origin === "real").length
  };
}

function readJsonSeed<T>(seedsDir: string, fileName: string): T {
  return JSON.parse(readFileSync(join(seedsDir, fileName), "utf8")) as T;
}

function wipeSeededTables(db: SqliteDatabase): void {
  db.prepare("DELETE FROM player_profile_history").run();
  db.prepare("DELETE FROM player_profiles").run();
  db.prepare("DELETE FROM player_profile_versions").run();
  db.prepare("DELETE FROM player_attribute_history").run();
  db.prepare("DELETE FROM player_attributes").run();
  db.prepare("DELETE FROM fixtures").run();
  db.prepare("DELETE FROM players").run();
  db.prepare("DELETE FROM player_dataset_versions").run();
  db.prepare("DELETE FROM clubs").run();
}

function insertClubs(db: SqliteDatabase, clubs: Club[]): void {
  const insertClub = db.prepare<[string, string, string, string, string, string, string, number | null, string | null, string | null, string, string]>(
    `
      INSERT INTO clubs (
        id, name, short_name, country, league, manager_real, stadium_name,
        stadium_capacity, kit_primary_hex, kit_secondary_hex, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const club of clubs) {
    insertClub.run(
      club.id,
      club.name,
      club.short_name,
      club.country,
      club.league,
      club.manager_real,
      club.stadium_name,
      club.stadium_capacity,
      club.kit_primary_hex,
      club.kit_secondary_hex,
      club.created_at,
      club.updated_at
    );
  }
}

function insertDatasetVersions(db: SqliteDatabase, datasetVersions: DatasetVersion[]): void {
  const insertDatasetVersion = db.prepare<[string, string, string | null, number, string | null, string, string]>(
    `
      INSERT INTO player_dataset_versions (
        id, name, description, is_active, parent_version_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const datasetVersion of datasetVersions) {
    insertDatasetVersion.run(
      datasetVersion.id,
      datasetVersion.name,
      datasetVersion.description,
      booleanToInteger(datasetVersion.is_active),
      datasetVersion.parent_version_id,
      datasetVersion.created_at,
      datasetVersion.updated_at
    );
  }
}

function insertProfileVersions(db: SqliteDatabase, profileVersions: PlayerProfileVersion[]): void {
  const insertProfileVersion = db.prepare<
    [string, string, string | null, number, string | null, string, string]
  >(
    `
      INSERT INTO player_profile_versions (
        id, name, description, is_active, parent_version_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const profileVersion of profileVersions) {
    insertProfileVersion.run(
      profileVersion.id,
      profileVersion.name,
      profileVersion.description,
      booleanToInteger(profileVersion.is_active),
      profileVersion.parent_version_id,
      profileVersion.created_at,
      profileVersion.updated_at
    );
  }
}

function insertPlayers(db: SqliteDatabase, players: Player[]): void {
  const insertPlayer = db.prepare(
    `
      INSERT INTO players (
        id, club_id, name, short_name, squad_number, position_primary, position_secondary,
        date_of_birth, nationality, height_cm, is_captain, is_eligible_european,
        injury_status, fitness, form, real_player_reference, player_origin, user_id,
        preset_archetype, budget_used, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const player of players) {
    insertPlayer.run(
      player.id,
      player.club_id,
      player.name,
      player.short_name,
      player.squad_number,
      player.position_primary,
      player.position_secondary,
      player.date_of_birth,
      player.nationality,
      player.height_cm,
      booleanToInteger(player.is_captain),
      booleanToInteger(player.is_eligible_european),
      player.injury_status,
      player.fitness,
      player.form,
      player.real_player_reference,
      player.player_origin,
      player.user_id,
      player.preset_archetype,
      player.budget_used,
      player.created_at,
      player.updated_at
    );
  }
}

function insertEmptyProfiles(
  db: SqliteDatabase,
  players: Player[],
  profileVersion: PlayerProfileVersion
): void {
  const insertProfile = db.prepare<
    [string, string, string, string, string | null, string | null, string, string, number, string, string]
  >(
    `
      INSERT INTO player_profiles (
        id, player_id, profile_version, tier, role_2004_05, qualitative_descriptor,
        generated_by, generated_at, edited, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const player of players.filter((seedPlayer) => seedPlayer.player_origin === "real")) {
    const profile: PlayerProfile = {
      id: `${player.id}:${profileVersion.id}`,
      player_id: player.id,
      profile_version: profileVersion.id,
      tier: "C",
      role_2004_05: null,
      qualitative_descriptor: null,
      generated_by: "human",
      generated_at: profileVersion.created_at,
      edited: false,
      created_at: profileVersion.created_at,
      updated_at: profileVersion.updated_at
    };

    insertProfile.run(
      profile.id,
      profile.player_id,
      profile.profile_version,
      profile.tier,
      profile.role_2004_05,
      profile.qualitative_descriptor,
      profile.generated_by,
      profile.generated_at,
      booleanToInteger(profile.edited),
      profile.created_at,
      profile.updated_at
    );
  }
}

function insertFixtures(db: SqliteDatabase, fixtures: Fixture[]): void {
  const insertFixture = db.prepare<[string, string, string, string, number, string, string, string, number | null, number | null, string | null, string, string]>(
    `
      INSERT INTO fixtures (
        id, home_club_id, away_club_id, round, leg, kicked_off_at, venue_name,
        venue_city, real_result_home_goals, real_result_away_goals, notes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const fixture of fixtures) {
    insertFixture.run(
      fixture.id,
      fixture.home_club_id,
      fixture.away_club_id,
      fixture.round,
      fixture.leg,
      fixture.kicked_off_at,
      fixture.venue_name,
      fixture.venue_city,
      fixture.real_result_home_goals,
      fixture.real_result_away_goals,
      fixture.notes,
      fixture.created_at,
      fixture.updated_at
    );
  }
}

function insertStubAttributes(
  db: SqliteDatabase,
  players: Player[],
  datasetVersions: DatasetVersion[]
): void {
  const activeDatasetVersion = datasetVersions.find((datasetVersion) => datasetVersion.is_active);

  if (!activeDatasetVersion) {
    throw new Error("Seed data must include an active dataset version");
  }

  const insertAttributes = db.prepare<[string, string, string, number, number, number, number, number, number, number, number, number, number, string | null, string, string, string, string]>(
    `
      INSERT INTO player_attributes (
        id, player_id, dataset_version, passing, shooting, tackling, saving, agility,
        strength, penalty_taking, perception, jumping, control, rationale,
        generated_by, generated_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  for (const player of players) {
    const attributes: PlayerAttributes = {
      id: `${player.id}:v0-stub`,
      player_id: player.id,
      dataset_version: activeDatasetVersion.id,
      ...ZERO_ATTRIBUTES,
      rationale: "Phase A stub - real attributes will be generated in Phase B.",
      generated_by: "human",
      generated_at: activeDatasetVersion.created_at,
      created_at: activeDatasetVersion.created_at,
      updated_at: activeDatasetVersion.updated_at
    };

    insertAttributes.run(
      attributes.id,
      attributes.player_id,
      attributes.dataset_version,
      attributes.passing,
      attributes.shooting,
      attributes.tackling,
      attributes.saving,
      attributes.agility,
      attributes.strength,
      attributes.penalty_taking,
      attributes.perception,
      attributes.jumping,
      attributes.control,
      attributes.rationale,
      attributes.generated_by,
      attributes.generated_at,
      attributes.created_at,
      attributes.updated_at
    );
  }
}

function booleanToInteger(value: boolean): number {
  return value ? 1 : 0;
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  const result = seed();
  console.log(
    `Seeded ${result.clubs} clubs, ${result.players} players, ${result.fixtures} fixtures, ${result.datasetVersions} dataset versions, and ${result.playerAttributes} player attribute rows into ${getDatabasePath()}`
  );
}
