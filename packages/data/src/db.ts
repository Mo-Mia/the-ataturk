import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DEFAULT_DATABASE_PATH, resolveRepoPath } from "./paths";
import type {
  Club,
  CreatePlayerProfileVersionInput,
  CreateDatasetVersionInput,
  DatasetVersion,
  Fixture,
  InjuryStatus,
  InsertUserPlayerInput,
  Player,
  PlayerAttributeChanges,
  PlayerBase,
  PlayerAttributeHistory,
  PlayerAttributeName,
  PlayerAttributes,
  PlayerProfile,
  PlayerProfileChanges,
  PlayerProfileExtractionCandidate,
  PlayerProfileFieldName,
  PlayerProfileHistory,
  PlayerProfileTier,
  PlayerProfileVersion,
  PlayerProfileVersionSummary,
  PlayerOrigin,
  Position,
  PresetArchetype,
  RealPlayer,
  SquadPlayerWithAttributes,
  UpdatePlayerProfileInput,
  UpdatePlayerAttributesInput,
  UserCreatedPlayer
} from "./types";
import { PLAYER_ATTRIBUTE_NAMES, PLAYER_PROFILE_FIELD_NAMES, PLAYER_PROFILE_TIERS } from "./types";

type SqliteDatabase = Database.Database;
type ClubRow = Club;

interface DatasetVersionRow extends Omit<DatasetVersion, "is_active"> {
  is_active: number;
}

interface PlayerProfileVersionRow extends Omit<PlayerProfileVersion, "is_active"> {
  is_active: number;
}

interface PlayerProfileVersionSummaryRow extends Omit<PlayerProfileVersionSummary, "is_active"> {
  is_active: number;
}

interface PlayerRow extends Omit<PlayerBase, "is_captain" | "is_eligible_european"> {
  is_captain: number;
  is_eligible_european: number;
  player_origin: PlayerOrigin;
  user_id: string | null;
  preset_archetype: PresetArchetype | null;
  budget_used: number | null;
}

type PlayerAttributesRow = PlayerAttributes;
type PlayerAttributeHistoryRow = PlayerAttributeHistory;
interface PlayerProfileRow extends Omit<PlayerProfile, "edited"> {
  edited: number;
}
type PlayerProfileHistoryRow = PlayerProfileHistory;
type FixtureRow = Fixture;

export class DataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataValidationError";
  }
}

export class DataNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataNotFoundError";
  }
}

let dbInstance: SqliteDatabase | undefined;
let dbPath: string | undefined;

export function getDatabasePath(databasePath = process.env.DATABASE_URL ?? DEFAULT_DATABASE_PATH): string {
  return resolveRepoPath(databasePath);
}

export function getDb(databasePath?: string): SqliteDatabase {
  const resolvedPath = getDatabasePath(databasePath);

  if (dbInstance && dbPath === resolvedPath && dbInstance.open) {
    return dbInstance;
  }

  if (dbInstance?.open) {
    dbInstance.close();
  }

  mkdirSync(dirname(resolvedPath), { recursive: true });

  dbInstance = new Database(resolvedPath);
  dbInstance.pragma("foreign_keys = ON");
  dbPath = resolvedPath;

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance?.open) {
    dbInstance.close();
  }

  dbInstance = undefined;
  dbPath = undefined;
}

export function listClubs(db = getDb()): Club[] {
  return db.prepare<[], ClubRow>("SELECT * FROM clubs ORDER BY name").all();
}

export function getClub(id: string, db = getDb()): Club | null {
  return db.prepare<[string], ClubRow>("SELECT * FROM clubs WHERE id = ?").get(id) ?? null;
}

export function listPlayersByClub(clubId: string, db = getDb()): Player[] {
  const rows = db
    .prepare<[string], PlayerRow>("SELECT * FROM players WHERE club_id = ? ORDER BY squad_number, name")
    .all(clubId);

  return rows.map(mapPlayerRow);
}

export function listRealPlayersByClub(clubId: string, db = getDb()): RealPlayer[] {
  const rows = db
    .prepare<[string], PlayerRow>(
      "SELECT * FROM players WHERE club_id = ? AND player_origin = 'real' ORDER BY squad_number, name"
    )
    .all(clubId);

  return rows.map(mapRealPlayerRow);
}

export function listUserPlayersByClub(clubId: string, db = getDb()): UserCreatedPlayer[] {
  const rows = db
    .prepare<[string], PlayerRow>(
      "SELECT * FROM players WHERE club_id = ? AND player_origin = 'user_created' ORDER BY squad_number, name"
    )
    .all(clubId);

  return rows.map(mapUserCreatedPlayerRow);
}

export function getPlayer(id: string, db = getDb()): Player | null {
  const row = db.prepare<[string], PlayerRow>("SELECT * FROM players WHERE id = ?").get(id);
  return row ? mapPlayerRow(row) : null;
}

export function getPlayerAttributes(
  playerId: string,
  datasetVersion: string,
  db = getDb()
): PlayerAttributes | null {
  return (
    db
      .prepare<[string, string], PlayerAttributesRow>(
        "SELECT * FROM player_attributes WHERE player_id = ? AND dataset_version = ?"
      )
      .get(playerId, datasetVersion) ?? null
  );
}

export function listDatasetVersions(db = getDb()): DatasetVersion[] {
  const rows = db
    .prepare<[], DatasetVersionRow>("SELECT * FROM player_dataset_versions ORDER BY created_at DESC, id")
    .all();

  return rows.map(mapDatasetVersionRow);
}

export function getDatasetVersion(id: string, db = getDb()): DatasetVersion | null {
  const row =
    db
      .prepare<[string], DatasetVersionRow>("SELECT * FROM player_dataset_versions WHERE id = ?")
      .get(id) ?? null;

  return row ? mapDatasetVersionRow(row) : null;
}

export function getActiveDatasetVersion(db = getDb()): DatasetVersion | null {
  const row =
    db
      .prepare<[], DatasetVersionRow>(
        "SELECT * FROM player_dataset_versions WHERE is_active = 1 LIMIT 1"
      )
      .get() ?? null;

  return row ? mapDatasetVersionRow(row) : null;
}

export function createDatasetVersion(
  input: CreateDatasetVersionInput,
  db = getDb()
): DatasetVersion {
  const now = new Date().toISOString();
  const createdAt = input.created_at ?? now;
  const updatedAt = input.updated_at ?? createdAt;
  const description = input.description ?? null;
  const parentVersionId = input.parent_version_id ?? null;

  const createVersion = db.transaction(() => {
    if (getDatasetVersion(input.id, db)) {
      throw new DataValidationError(`Dataset version '${input.id}' already exists`);
    }

    if (parentVersionId && !getDatasetVersion(parentVersionId, db)) {
      throw new DataValidationError(`Parent dataset version '${parentVersionId}' does not exist`);
    }

    db.prepare<[string, string, string | null, string | null, string, string]>(
      `
        INSERT INTO player_dataset_versions (
          id, name, description, is_active, parent_version_id, created_at, updated_at
        )
        VALUES (?, ?, ?, 0, ?, ?, ?)
      `
    ).run(input.id, input.name, description, parentVersionId, createdAt, updatedAt);

    if (parentVersionId) {
      const parentRows = db
        .prepare<[string], PlayerAttributesRow>(
          "SELECT * FROM player_attributes WHERE dataset_version = ? ORDER BY player_id"
        )
        .all(parentVersionId);
      const insertAttributes = db.prepare<
        [
          string,
          string,
          string,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          string | null,
          string,
          string,
          string,
          string
        ]
      >(
        `
          INSERT INTO player_attributes (
            id, player_id, dataset_version, passing, shooting, tackling, saving, agility,
            strength, penalty_taking, perception, jumping, control, rationale,
            generated_by, generated_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const row of parentRows) {
        insertAttributes.run(
          `${row.player_id}:${input.id}`,
          row.player_id,
          input.id,
          row.passing,
          row.shooting,
          row.tackling,
          row.saving,
          row.agility,
          row.strength,
          row.penalty_taking,
          row.perception,
          row.jumping,
          row.control,
          row.rationale,
          row.generated_by,
          row.generated_at,
          createdAt,
          updatedAt
        );
      }
    }
  });

  createVersion();

  const created = getDatasetVersion(input.id, db);
  if (!created) {
    throw new DataNotFoundError(`Dataset version '${input.id}' was not created`);
  }

  return created;
}

export function activateDatasetVersion(id: string, db = getDb()): DatasetVersion {
  const activate = db.transaction(() => {
    if (!getDatasetVersion(id, db)) {
      throw new DataNotFoundError(`Dataset version '${id}' does not exist`);
    }

    db.prepare("UPDATE player_dataset_versions SET is_active = 0, updated_at = ?").run(
      new Date().toISOString()
    );
    db.prepare<[string, string]>(
      "UPDATE player_dataset_versions SET is_active = 1, updated_at = ? WHERE id = ?"
    ).run(new Date().toISOString(), id);
  });

  activate();

  const activated = getDatasetVersion(id, db);
  if (!activated) {
    throw new DataNotFoundError(`Dataset version '${id}' does not exist`);
  }

  return activated;
}

export function listProfileVersions(db = getDb()): PlayerProfileVersionSummary[] {
  const rows = db
    .prepare<[], PlayerProfileVersionSummaryRow>(
      `
        SELECT
          player_profile_versions.*,
          COUNT(player_profiles.id) AS profile_count,
          COALESCE(SUM(CASE WHEN player_profiles.edited = 0 THEN 1 ELSE 0 END), 0) AS uncurated_count,
          COALESCE(SUM(CASE WHEN player_profiles.generated_by = 'llm-extraction-failed' THEN 1 ELSE 0 END), 0) AS failed_count
        FROM player_profile_versions
        LEFT JOIN player_profiles ON player_profiles.profile_version = player_profile_versions.id
        GROUP BY player_profile_versions.id
        ORDER BY player_profile_versions.created_at DESC, player_profile_versions.id
      `
    )
    .all();

  return rows.map(mapProfileVersionSummaryRow);
}

export function getProfileVersion(id: string, db = getDb()): PlayerProfileVersion | null {
  const row =
    db
      .prepare<[string], PlayerProfileVersionRow>("SELECT * FROM player_profile_versions WHERE id = ?")
      .get(id) ?? null;

  return row ? mapProfileVersionRow(row) : null;
}

export function getActiveProfileVersion(db = getDb()): PlayerProfileVersion | null {
  const row =
    db
      .prepare<[], PlayerProfileVersionRow>(
        "SELECT * FROM player_profile_versions WHERE is_active = 1 LIMIT 1"
      )
      .get() ?? null;

  return row ? mapProfileVersionRow(row) : null;
}

export function createProfileVersion(
  input: CreatePlayerProfileVersionInput,
  db = getDb()
): PlayerProfileVersion {
  const now = new Date().toISOString();
  const createdAt = input.created_at ?? now;
  const updatedAt = input.updated_at ?? createdAt;
  const description = input.description ?? null;
  const parentVersionId = input.parent_version_id ?? null;

  const createVersion = db.transaction(() => {
    if (getProfileVersion(input.id, db)) {
      throw new DataValidationError(`Profile version '${input.id}' already exists`);
    }

    if (parentVersionId && !getProfileVersion(parentVersionId, db)) {
      throw new DataValidationError(`Parent profile version '${parentVersionId}' does not exist`);
    }

    db.prepare<[string, string, string | null, string | null, string, string]>(
      `
        INSERT INTO player_profile_versions (
          id, name, description, is_active, parent_version_id, created_at, updated_at
        )
        VALUES (?, ?, ?, 0, ?, ?, ?)
      `
    ).run(input.id, input.name, description, parentVersionId, createdAt, updatedAt);

    if (parentVersionId) {
      const parentRows = db
        .prepare<[string], PlayerProfileRow>(
          "SELECT * FROM player_profiles WHERE profile_version = ? ORDER BY player_id"
        )
        .all(parentVersionId);
      const insertProfile = db.prepare<
        [string, string, string, PlayerProfileTier, string | null, string | null, string, string, number, string, string]
      >(
        `
          INSERT INTO player_profiles (
            id, player_id, profile_version, tier, role_2004_05, qualitative_descriptor,
            generated_by, generated_at, edited, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const row of parentRows) {
        insertProfile.run(
          `${row.player_id}:${input.id}`,
          row.player_id,
          input.id,
          row.tier,
          row.role_2004_05,
          row.qualitative_descriptor,
          row.generated_by,
          row.generated_at,
          row.edited,
          createdAt,
          updatedAt
        );
      }
    }
  });

  createVersion();

  const created = getProfileVersion(input.id, db);
  if (!created) {
    throw new DataNotFoundError(`Profile version '${input.id}' was not created`);
  }

  return created;
}

export function activateProfileVersion(id: string, db = getDb()): PlayerProfileVersion {
  const activate = db.transaction(() => {
    if (!getProfileVersion(id, db)) {
      throw new DataNotFoundError(`Profile version '${id}' does not exist`);
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE player_profile_versions SET is_active = 0, updated_at = ?").run(now);
    db.prepare<[string, string]>(
      "UPDATE player_profile_versions SET is_active = 1, updated_at = ? WHERE id = ?"
    ).run(now, id);
  });

  activate();

  const activated = getProfileVersion(id, db);
  if (!activated) {
    throw new DataNotFoundError(`Profile version '${id}' does not exist`);
  }

  return activated;
}

export function getPlayerProfile(
  playerId: string,
  profileVersion: string,
  db = getDb()
): PlayerProfile | null {
  const row =
    db
      .prepare<[string, string], PlayerProfileRow>(
        "SELECT * FROM player_profiles WHERE player_id = ? AND profile_version = ?"
      )
      .get(playerId, profileVersion) ?? null;

  return row ? mapPlayerProfileRow(row) : null;
}

export function updatePlayerProfile(
  input: UpdatePlayerProfileInput,
  db = getDb()
): PlayerProfile {
  validateProfileChanges(input.changes);

  const changedBy = input.changedBy ?? "human:admin";
  const changedAt = input.changedAt ?? new Date().toISOString();
  const fieldNames = Object.keys(input.changes) as PlayerProfileFieldName[];

  const updateProfile = db.transaction(() => {
    if (!getPlayer(input.playerId, db)) {
      throw new DataNotFoundError(`Player '${input.playerId}' does not exist`);
    }

    if (!getProfileVersion(input.profileVersion, db)) {
      throw new DataNotFoundError(`Profile version '${input.profileVersion}' does not exist`);
    }

    const current = getPlayerProfile(input.playerId, input.profileVersion, db);
    if (!current) {
      throw new DataNotFoundError(
        `Profile for player '${input.playerId}' in '${input.profileVersion}' does not exist`
      );
    }

    const changedNames = fieldNames.filter((fieldName) => input.changes[fieldName] !== current[fieldName]);

    if (changedNames.length === 0) {
      return current;
    }

    const insertHistory = db.prepare<[string, string, string, string | null, string | null, string, string]>(
      `
        INSERT INTO player_profile_history (
          player_id, profile_version, field_name, old_value, new_value, changed_at, changed_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    );

    for (const fieldName of changedNames) {
      const newValue = input.changes[fieldName];
      if (newValue === undefined) {
        continue;
      }

      insertHistory.run(
        input.playerId,
        input.profileVersion,
        fieldName,
        current[fieldName],
        newValue,
        changedAt,
        changedBy
      );
    }

    const assignments = changedNames.map((fieldName) => `${fieldName} = ?`);
    const values = changedNames.map((fieldName) => input.changes[fieldName] ?? null);

    assignments.push("generated_by = ?", "generated_at = ?", "edited = ?", "updated_at = ?");
    values.push(
      input.generatedBy ?? (input.markEdited === false ? current.generated_by : "human-edited"),
      input.generatedAt ?? (input.markEdited === false ? current.generated_at : changedAt),
      String(booleanToInteger(input.markEdited ?? true)),
      changedAt
    );

    db.prepare(
      `
        UPDATE player_profiles
        SET ${assignments.join(", ")}
        WHERE player_id = ? AND profile_version = ?
      `
    ).run(...values, input.playerId, input.profileVersion);

    const updated = getPlayerProfile(input.playerId, input.profileVersion, db);
    if (!updated) {
      throw new DataNotFoundError(
        `Profile for player '${input.playerId}' in '${input.profileVersion}' does not exist`
      );
    }

    return updated;
  });

  return updateProfile();
}

export function getPlayerProfileHistory(
  playerId: string,
  profileVersion?: string,
  limit = 50,
  db = getDb()
): PlayerProfileHistory[] {
  if (limit < 1 || !Number.isInteger(limit)) {
    throw new DataValidationError("History limit must be a positive integer");
  }

  if (profileVersion) {
    return db
      .prepare<[string, string, number], PlayerProfileHistoryRow>(
        `
          SELECT *
          FROM player_profile_history
          WHERE player_id = ? AND profile_version = ?
          ORDER BY changed_at DESC, id DESC
          LIMIT ?
        `
      )
      .all(playerId, profileVersion, limit);
  }

  return db
    .prepare<[string, number], PlayerProfileHistoryRow>(
      `
        SELECT *
        FROM player_profile_history
        WHERE player_id = ?
        ORDER BY changed_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(playerId, limit);
}

export function listProfileExtractionCandidates(
  profileVersion: string,
  playerIds?: string[],
  db = getDb()
): PlayerProfileExtractionCandidate[] {
  if (!getProfileVersion(profileVersion, db)) {
    throw new DataNotFoundError(`Profile version '${profileVersion}' does not exist`);
  }

  const rows = db
    .prepare<[string], PlayerProfileRow>(
      `
        SELECT *
        FROM player_profiles
        WHERE profile_version = ?
          AND edited = 0
          AND (role_2004_05 IS NULL OR generated_by = 'llm-extraction-failed')
        ORDER BY player_id
      `
    )
    .all(profileVersion);
  const requestedPlayerIds = playerIds === undefined ? null : new Set(playerIds);

  return rows
    .filter((row) => requestedPlayerIds === null || requestedPlayerIds.has(row.player_id))
    .map((row) => {
      const player = getPlayer(row.player_id, db);
      if (!player) {
        throw new DataNotFoundError(`Player '${row.player_id}' does not exist`);
      }

      return {
        player,
        profile: mapPlayerProfileRow(row)
      };
    });
}

export function markPlayerProfileExtractionFailed(
  playerId: string,
  profileVersion: string,
  generatedAt = new Date().toISOString(),
  db = getDb()
): PlayerProfile {
  db.prepare<[number, string, string, string, string]>(
    `
      UPDATE player_profiles
      SET generated_by = 'llm-extraction-failed', edited = ?, generated_at = ?, updated_at = ?
      WHERE player_id = ? AND profile_version = ?
    `
  ).run(booleanToInteger(false), generatedAt, generatedAt, playerId, profileVersion);

  const profile = getPlayerProfile(playerId, profileVersion, db);
  if (!profile) {
    throw new DataNotFoundError(`Profile for player '${playerId}' in '${profileVersion}' does not exist`);
  }

  return profile;
}

export function listFixtures(db = getDb()): Fixture[] {
  return db.prepare<[], FixtureRow>("SELECT * FROM fixtures ORDER BY kicked_off_at").all();
}

export function updatePlayerAttributes(
  input: UpdatePlayerAttributesInput,
  db = getDb()
): PlayerAttributes {
  validateAttributeChanges(input.changes);

  const changedBy = input.changedBy ?? "human:admin";
  const changedAt = input.changedAt ?? new Date().toISOString();
  const attributeNames = Object.keys(input.changes) as PlayerAttributeName[];

  const updateAttributes = db.transaction(() => {
    if (!getPlayer(input.playerId, db)) {
      throw new DataNotFoundError(`Player '${input.playerId}' does not exist`);
    }

    if (!getDatasetVersion(input.datasetVersion, db)) {
      throw new DataNotFoundError(`Dataset version '${input.datasetVersion}' does not exist`);
    }

    const current = getPlayerAttributes(input.playerId, input.datasetVersion, db);
    if (!current) {
      throw new DataNotFoundError(
        `Attributes for player '${input.playerId}' in '${input.datasetVersion}' do not exist`
      );
    }

    const changedNames = attributeNames.filter(
      (attributeName) => input.changes[attributeName] !== current[attributeName]
    );

    if (changedNames.length === 0) {
      return current;
    }

    const insertHistory = db.prepare<[string, string, string, number, number, string, string]>(
      `
        INSERT INTO player_attribute_history (
          player_id, dataset_version, attribute_name, old_value, new_value, changed_at, changed_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    );

    for (const attributeName of changedNames) {
      const newValue = input.changes[attributeName];
      if (newValue === undefined) {
        continue;
      }

      insertHistory.run(
        input.playerId,
        input.datasetVersion,
        attributeName,
        current[attributeName],
        newValue,
        changedAt,
        changedBy
      );
    }

    const assignments = changedNames.map((attributeName) => `${attributeName} = ?`).join(", ");
    const values = changedNames.map((attributeName) => input.changes[attributeName] ?? current[attributeName]);

    db.prepare(
      `
        UPDATE player_attributes
        SET ${assignments}, updated_at = ?
        WHERE player_id = ? AND dataset_version = ?
      `
    ).run(...values, changedAt, input.playerId, input.datasetVersion);

    const updated = getPlayerAttributes(input.playerId, input.datasetVersion, db);
    if (!updated) {
      throw new DataNotFoundError(
        `Attributes for player '${input.playerId}' in '${input.datasetVersion}' do not exist`
      );
    }

    return updated;
  });

  return updateAttributes();
}

export function getPlayerAttributeHistory(
  playerId: string,
  datasetVersion?: string,
  limit = 50,
  db = getDb()
): PlayerAttributeHistory[] {
  if (limit < 1 || !Number.isInteger(limit)) {
    throw new DataValidationError("History limit must be a positive integer");
  }

  if (datasetVersion) {
    return db
      .prepare<[string, string, number], PlayerAttributeHistoryRow>(
        `
          SELECT *
          FROM player_attribute_history
          WHERE player_id = ? AND dataset_version = ?
          ORDER BY changed_at DESC, id DESC
          LIMIT ?
        `
      )
      .all(playerId, datasetVersion, limit);
  }

  return db
    .prepare<[string, number], PlayerAttributeHistoryRow>(
      `
        SELECT *
        FROM player_attribute_history
        WHERE player_id = ?
        ORDER BY changed_at DESC, id DESC
        LIMIT ?
      `
    )
    .all(playerId, limit);
}

export function insertUserPlayer(
  playerData: InsertUserPlayerInput,
  db = getDb()
): UserCreatedPlayer {
  const now = new Date().toISOString();
  const createdAt = playerData.created_at ?? now;
  const updatedAt = playerData.updated_at ?? createdAt;

  db.prepare(
    `
      INSERT INTO players (
        id, club_id, name, short_name, squad_number, position_primary, position_secondary,
        date_of_birth, nationality, height_cm, is_captain, is_eligible_european,
        injury_status, fitness, form, real_player_reference, player_origin, user_id,
        preset_archetype, budget_used, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user_created', ?, ?, ?, ?, ?)
    `
  ).run(
    playerData.id,
    playerData.club_id,
    playerData.name,
    playerData.short_name,
    playerData.squad_number,
    playerData.position_primary,
    playerData.position_secondary,
    playerData.date_of_birth,
    playerData.nationality,
    playerData.height_cm,
    booleanToInteger(playerData.is_captain ?? false),
    booleanToInteger(playerData.is_eligible_european ?? true),
    playerData.injury_status ?? "fit",
    playerData.fitness ?? 100,
    playerData.form ?? 50,
    playerData.real_player_reference ?? null,
    playerData.user_id,
    playerData.preset_archetype,
    playerData.budget_used,
    createdAt,
    updatedAt
  );

  const inserted = getPlayer(playerData.id, db);
  if (!inserted || inserted.player_origin !== "user_created") {
    throw new Error(`Failed to insert user-created player ${playerData.id}`);
  }

  return inserted;
}

export function listSquadWithActiveAttributes(
  clubId: string,
  origin?: PlayerOrigin,
  db = getDb()
): SquadPlayerWithAttributes[] {
  const activeVersion = getActiveDatasetVersion(db);
  const players = origin ? listPlayersByOrigin(clubId, origin, db) : listPlayersByClub(clubId, db);

  return players.map((player) => ({
    player,
    attributes: activeVersion ? getPlayerAttributes(player.id, activeVersion.id, db) : null
  }));
}

function listPlayersByOrigin(clubId: string, origin: PlayerOrigin, db: SqliteDatabase): Player[] {
  return origin === "real" ? listRealPlayersByClub(clubId, db) : listUserPlayersByClub(clubId, db);
}

function mapProfileVersionRow(row: PlayerProfileVersionRow): PlayerProfileVersion {
  return {
    ...row,
    is_active: integerToBoolean(row.is_active)
  };
}

function mapProfileVersionSummaryRow(row: PlayerProfileVersionSummaryRow): PlayerProfileVersionSummary {
  return {
    ...row,
    is_active: integerToBoolean(row.is_active)
  };
}

function mapDatasetVersionRow(row: DatasetVersionRow): DatasetVersion {
  return {
    ...row,
    is_active: integerToBoolean(row.is_active)
  };
}

function mapPlayerProfileRow(row: PlayerProfileRow): PlayerProfile {
  return {
    ...row,
    edited: integerToBoolean(row.edited)
  };
}

function mapPlayerRow(row: PlayerRow): Player {
  return row.player_origin === "real" ? mapRealPlayerRow(row) : mapUserCreatedPlayerRow(row);
}

function mapRealPlayerRow(row: PlayerRow): RealPlayer {
  return {
    ...mapPlayerBase(row),
    player_origin: "real",
    user_id: null,
    preset_archetype: null,
    budget_used: null
  };
}

function mapUserCreatedPlayerRow(row: PlayerRow): UserCreatedPlayer {
  return {
    ...mapPlayerBase(row),
    player_origin: "user_created",
    user_id: requireString(row.user_id, "user_id"),
    preset_archetype: requirePresetArchetype(row.preset_archetype),
    budget_used: requireNumber(row.budget_used, "budget_used")
  };
}

function mapPlayerBase(row: PlayerRow): PlayerBase {
  return {
    id: row.id,
    club_id: row.club_id,
    name: row.name,
    short_name: row.short_name,
    squad_number: row.squad_number,
    position_primary: row.position_primary,
    position_secondary: row.position_secondary,
    date_of_birth: row.date_of_birth,
    nationality: row.nationality,
    height_cm: row.height_cm,
    is_captain: integerToBoolean(row.is_captain),
    is_eligible_european: integerToBoolean(row.is_eligible_european),
    injury_status: row.injury_status,
    fitness: row.fitness,
    form: row.form,
    real_player_reference: row.real_player_reference,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function integerToBoolean(value: number): boolean {
  return value === 1;
}

function booleanToInteger(value: boolean): number {
  return value ? 1 : 0;
}

function validateAttributeChanges(changes: PlayerAttributeChanges): void {
  const attributeNames = Object.keys(changes);

  for (const attributeName of attributeNames) {
    if (!isPlayerAttributeName(attributeName)) {
      throw new DataValidationError(`Unknown attribute '${attributeName}'`);
    }

    const value = changes[attributeName];
    if (value === undefined) {
      throw new DataValidationError(`Attribute '${attributeName}' must be an integer from 0 to 100`);
    }

    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new DataValidationError(`Attribute '${attributeName}' must be an integer from 0 to 100`);
    }
  }
}

function validateProfileChanges(changes: PlayerProfileChanges): void {
  const fieldNames = Object.keys(changes);

  for (const fieldName of fieldNames) {
    if (!isPlayerProfileFieldName(fieldName)) {
      throw new DataValidationError(`Unknown profile field '${fieldName}'`);
    }

    const value = changes[fieldName];
    if (value === undefined) {
      throw new DataValidationError(`Profile field '${fieldName}' is required`);
    }

    if (fieldName === "tier") {
      if (!isPlayerProfileTier(value)) {
        throw new DataValidationError("Profile tier must be one of S, A, B, C, or D");
      }
      continue;
    }

    if (value !== null && typeof value !== "string") {
      throw new DataValidationError(`Profile field '${fieldName}' must be text`);
    }
  }
}

function isPlayerAttributeName(value: string): value is PlayerAttributeName {
  return PLAYER_ATTRIBUTE_NAMES.includes(value as PlayerAttributeName);
}

function isPlayerProfileFieldName(value: string): value is PlayerProfileFieldName {
  return PLAYER_PROFILE_FIELD_NAMES.includes(value as PlayerProfileFieldName);
}

function isPlayerProfileTier(value: unknown): value is PlayerProfileTier {
  return PLAYER_PROFILE_TIERS.includes(value as PlayerProfileTier);
}

function requireString(value: string | null, fieldName: string): string {
  if (value === null) {
    throw new Error(`Expected ${fieldName} to be non-null`);
  }

  return value;
}

function requireNumber(value: number | null, fieldName: string): number {
  if (value === null) {
    throw new Error(`Expected ${fieldName} to be non-null`);
  }

  return value;
}

function requirePresetArchetype(value: PresetArchetype | null): PresetArchetype {
  if (value === null) {
    throw new Error("Expected preset_archetype to be non-null");
  }

  return value;
}

export type { SqliteDatabase, InjuryStatus, PlayerOrigin, Position, PresetArchetype };
