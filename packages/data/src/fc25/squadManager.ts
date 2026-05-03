import { randomUUID } from "node:crypto";

import { getDb, type SqliteDatabase } from "../db";
import type {
  Fc25Club,
  Fc25ClubId,
  Fc25DatasetVersion,
  Fc25Position,
  Fc25SquadPlayer
} from "../types";
import { getActiveFc25DatasetVersion, loadFc25Squad } from "./importer";

export type SquadManagerSuggestion =
  | {
      suggestionId: string;
      type: "player_update";
      playerId: string;
      changes: {
        name?: string;
        position?: Fc25Position;
        nationality?: string;
        age?: number;
      };
      rationale?: string;
    }
  | {
      suggestionId: string;
      type: "player_addition";
      livePlayer: {
        id: number;
        name: string;
        position: string;
        dateOfBirth?: string | null;
        nationality: string;
        shirtNumber?: number | null;
      };
      proposed: {
        name: string;
        position: Fc25Position;
        nationality: string;
        age: number;
        shirtNumber?: number | null;
      };
      rationale?: string;
    }
  | {
      suggestionId: string;
      type: "player_removal";
      playerId: string;
      rationale?: string;
    };

export interface ApplySquadManagerSuggestionsInput {
  clubId: Fc25ClubId;
  baseDatasetVersionId: string;
  suggestions: SquadManagerSuggestion[];
  rationale?: string;
  now?: Date;
  db?: SqliteDatabase;
}

export interface ApplySquadManagerSuggestionsResult {
  newDatasetVersionId: string;
  activated: true;
  summary: {
    applied: number;
    updated: number;
    added: number;
    removed: number;
  };
}

interface Fc25DatasetVersionRow extends Omit<Fc25DatasetVersion, "is_active"> {
  is_active: number;
}

interface AverageRow {
  average_overall: number | null;
  average_rank: number | null;
}

interface ExistingPlayerRow {
  id: string;
  overall: number;
}

interface TemplatePlayerRow {
  overall: number;
  rank: number;
  height_cm: number;
  weight_kg: number;
  preferred_foot: "left" | "right" | "either";
  weak_foot_rating: 1 | 2 | 3 | 4 | 5;
  skill_moves_rating: 1 | 2 | 3 | 4 | 5;
  source_url: string;
  acceleration: number;
  sprint_speed: number;
  finishing: number;
  shot_power: number;
  long_shots: number;
  positioning: number;
  volleys: number;
  penalties: number;
  vision: number;
  crossing: number;
  free_kick_accuracy: number;
  short_passing: number;
  long_passing: number;
  curve: number;
  dribbling: number;
  agility: number;
  balance: number;
  reactions: number;
  ball_control: number;
  composure: number;
  interceptions: number;
  heading_accuracy: number;
  defensive_awareness: number;
  standing_tackle: number;
  sliding_tackle: number;
  jumping: number;
  stamina: number;
  strength: number;
  aggression: number;
  gk_diving: number | null;
  gk_handling: number | null;
  gk_kicking: number | null;
  gk_positioning: number | null;
  gk_reflexes: number | null;
}

export function listFc25DatasetVersions(db = getDb()): Fc25DatasetVersion[] {
  return db
    .prepare<[], Fc25DatasetVersionRow>(
      "SELECT * FROM fc25_dataset_versions ORDER BY created_at DESC, id"
    )
    .all()
    .map(mapDatasetVersionRow);
}

export function getFc25DatasetVersion(
  datasetVersionId: string,
  db = getDb()
): Fc25DatasetVersion | null {
  const row =
    db
      .prepare<[string], Fc25DatasetVersionRow>(
        "SELECT * FROM fc25_dataset_versions WHERE id = ?"
      )
      .get(datasetVersionId) ?? null;

  return row ? mapDatasetVersionRow(row) : null;
}

export function getFc25Club(
  clubId: Fc25ClubId,
  datasetVersionId = getActiveFc25DatasetVersion()?.id,
  db = getDb()
): Fc25Club | null {
  if (!datasetVersionId) {
    return null;
  }

  return (
    db
      .prepare<[string, string], Fc25Club>(
        "SELECT * FROM fc25_clubs WHERE dataset_version_id = ? AND id = ?"
      )
      .get(datasetVersionId, clubId) ?? null
  );
}

export function loadFc25SquadForVerification(
  clubId: Fc25ClubId,
  datasetVersionId = getActiveFc25DatasetVersion()?.id,
  db = getDb()
): Fc25SquadPlayer[] {
  return loadFc25Squad(clubId, datasetVersionId, { include: "all", db }).players;
}

export function applySquadManagerSuggestions(
  input: ApplySquadManagerSuggestionsInput
): ApplySquadManagerSuggestionsResult {
  const db = input.db ?? getDb();
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const newDatasetVersionId = createSquadManagerVersionId(now);
  const summary = {
    applied: 0,
    updated: 0,
    added: 0,
    removed: 0
  };

  const applyTransaction = db.transaction(() => {
    const baseVersion = getFc25DatasetVersion(input.baseDatasetVersionId, db);
    if (!baseVersion) {
      throw new Error(`FC25 dataset version '${input.baseDatasetVersionId}' does not exist`);
    }

    if (!getFc25Club(input.clubId, input.baseDatasetVersionId, db)) {
      throw new Error(
        `Club '${input.clubId}' does not exist in FC25 dataset '${input.baseDatasetVersionId}'`
      );
    }

    insertVersionCopy(db, {
      newDatasetVersionId,
      baseVersion,
      description: describeAppliedSuggestions(input.suggestions, input.rationale),
      nowIso
    });
    copyVersionRows(db, input.baseDatasetVersionId, newDatasetVersionId, nowIso);

    for (const suggestion of input.suggestions) {
      validateSuggestion(suggestion);

      if (suggestion.type === "player_update") {
        applyPlayerUpdate(db, newDatasetVersionId, suggestion);
        summary.updated += 1;
      } else if (suggestion.type === "player_addition") {
        applyPlayerAddition(db, newDatasetVersionId, input.clubId, suggestion, nowIso);
        summary.added += 1;
      } else {
        applyPlayerRemoval(db, newDatasetVersionId, input.clubId, suggestion, nowIso);
        summary.removed += 1;
      }

      summary.applied += 1;
    }

    activateFc25DatasetVersion(db, newDatasetVersionId, nowIso);
  });

  applyTransaction();

  return {
    newDatasetVersionId,
    activated: true,
    summary
  };
}

function insertVersionCopy(
  db: SqliteDatabase,
  input: {
    newDatasetVersionId: string;
    baseVersion: Fc25DatasetVersion;
    description: string;
    nowIso: string;
  }
): void {
  db.prepare(
    `
      INSERT INTO fc25_dataset_versions (
        id, name, source_file, source_file_sha256, description, is_active, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `
  ).run(
    input.newDatasetVersionId,
    `${input.baseVersion.name} via squad-manager`,
    `squad-manager:${input.baseVersion.id}`,
    input.baseVersion.source_file_sha256,
    input.description,
    input.nowIso,
    input.nowIso
  );
}

function copyVersionRows(
  db: SqliteDatabase,
  baseDatasetVersionId: string,
  newDatasetVersionId: string,
  nowIso: string
): void {
  db.prepare(
    `
      INSERT INTO fc25_clubs (
        dataset_version_id, id, name, short_name, country, league, fc25_team_id, created_at, updated_at
      )
      SELECT ?, id, name, short_name, country, league, fc25_team_id, ?, ?
      FROM fc25_clubs
      WHERE dataset_version_id = ?
    `
  ).run(newDatasetVersionId, nowIso, nowIso, baseDatasetVersionId);

  db.prepare(
    `
      INSERT INTO fc25_players (
        dataset_version_id, id, fc25_player_id, name, short_name, overall, rank, position,
        alternative_positions, age, nationality, height_cm, weight_kg, preferred_foot,
        weak_foot_rating, skill_moves_rating, source_url, play_style,
        acceleration, sprint_speed, finishing, shot_power, long_shots, positioning,
        volleys, penalties, vision, crossing, free_kick_accuracy, short_passing,
        long_passing, curve, dribbling, agility, balance, reactions, ball_control,
        composure, interceptions, heading_accuracy, defensive_awareness, standing_tackle,
        sliding_tackle, jumping, stamina, strength, aggression,
        gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
        created_at, updated_at
      )
      SELECT
        ?, id, fc25_player_id, name, short_name, overall, rank, position,
        alternative_positions, age, nationality, height_cm, weight_kg, preferred_foot,
        weak_foot_rating, skill_moves_rating, source_url, play_style,
        acceleration, sprint_speed, finishing, shot_power, long_shots, positioning,
        volleys, penalties, vision, crossing, free_kick_accuracy, short_passing,
        long_passing, curve, dribbling, agility, balance, reactions, ball_control,
        composure, interceptions, heading_accuracy, defensive_awareness, standing_tackle,
        sliding_tackle, jumping, stamina, strength, aggression,
        gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
        ?, ?
      FROM fc25_players
      WHERE dataset_version_id = ?
    `
  ).run(newDatasetVersionId, nowIso, nowIso, baseDatasetVersionId);

  db.prepare(
    `
      INSERT INTO fc25_squads (
        dataset_version_id, club_id, player_id, squad_role, shirt_number, sort_order,
        overall, created_at, updated_at
      )
      SELECT ?, club_id, player_id, squad_role, shirt_number, sort_order, overall, ?, ?
      FROM fc25_squads
      WHERE dataset_version_id = ?
    `
  ).run(newDatasetVersionId, nowIso, nowIso, baseDatasetVersionId);
}

function applyPlayerUpdate(
  db: SqliteDatabase,
  datasetVersionId: string,
  suggestion: Extract<SquadManagerSuggestion, { type: "player_update" }>
): void {
  assertPlayerExists(db, datasetVersionId, suggestion.playerId);

  const changes: string[] = [];
  const params: Array<string | number> = [];

  if (suggestion.changes.name !== undefined) {
    changes.push("name = ?", "short_name = ?");
    params.push(suggestion.changes.name, shortNameFor(suggestion.changes.name));
  }
  if (suggestion.changes.position !== undefined) {
    changes.push("position = ?");
    params.push(suggestion.changes.position);
  }
  if (suggestion.changes.nationality !== undefined) {
    changes.push("nationality = ?");
    params.push(suggestion.changes.nationality);
  }
  if (suggestion.changes.age !== undefined) {
    changes.push("age = ?");
    params.push(suggestion.changes.age);
  }

  if (changes.length === 0) {
    throw new Error(`Suggestion '${suggestion.suggestionId}' has no player update changes`);
  }

  params.push(new Date().toISOString(), datasetVersionId, suggestion.playerId);
  db.prepare(
    `
      UPDATE fc25_players
      SET ${changes.join(", ")}, updated_at = ?
      WHERE dataset_version_id = ? AND id = ?
    `
  ).run(...params);
}

function applyPlayerAddition(
  db: SqliteDatabase,
  datasetVersionId: string,
  clubId: Fc25ClubId,
  suggestion: Extract<SquadManagerSuggestion, { type: "player_addition" }>,
  nowIso: string
): void {
  const playerId = `fd-${suggestion.livePlayer.id}`;
  if (playerExists(db, datasetVersionId, playerId)) {
    throw new Error(`Player '${playerId}' already exists in dataset '${datasetVersionId}'`);
  }

  const template = templateForPosition(db, datasetVersionId, clubId, suggestion.proposed.position);
  const overall = template.overall;
  const nextSortOrder = nextSquadSortOrder(db, datasetVersionId, clubId);

  db.prepare(
    `
      INSERT INTO fc25_players (
        dataset_version_id, id, fc25_player_id, name, short_name, overall, rank, position,
        alternative_positions, age, nationality, height_cm, weight_kg, preferred_foot,
        weak_foot_rating, skill_moves_rating, source_url, play_style,
        acceleration, sprint_speed, finishing, shot_power, long_shots, positioning,
        volleys, penalties, vision, crossing, free_kick_accuracy, short_passing,
        long_passing, curve, dribbling, agility, balance, reactions, ball_control,
        composure, interceptions, heading_accuracy, defensive_awareness, standing_tackle,
        sliding_tackle, jumping, stamina, strength, aggression,
        gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
        created_at, updated_at
      )
      VALUES (
        @datasetVersionId, @id, @fc25PlayerId, @name, @shortName, @overall, @rank, @position,
        '[]', @age, @nationality, @heightCm, @weightKg, @preferredFoot,
        @weakFootRating, @skillMovesRating, @sourceUrl, NULL,
        @acceleration, @sprintSpeed, @finishing, @shotPower, @longShots, @positioning,
        @volleys, @penalties, @vision, @crossing, @freeKickAccuracy, @shortPassing,
        @longPassing, @curve, @dribbling, @agility, @balance, @reactions, @ballControl,
        @composure, @interceptions, @headingAccuracy, @defensiveAwareness, @standingTackle,
        @slidingTackle, @jumping, @stamina, @strength, @aggression,
        @gkDiving, @gkHandling, @gkKicking, @gkPositioning, @gkReflexes,
        @nowIso, @nowIso
      )
    `
  ).run({
    datasetVersionId,
    id: playerId,
    fc25PlayerId: playerId,
    name: suggestion.proposed.name,
    shortName: shortNameFor(suggestion.proposed.name),
    overall,
    rank: template.rank,
    position: suggestion.proposed.position,
    age: suggestion.proposed.age,
    nationality: suggestion.proposed.nationality,
    heightCm: template.height_cm,
    weightKg: template.weight_kg,
    preferredFoot: template.preferred_foot,
    weakFootRating: template.weak_foot_rating,
    skillMovesRating: template.skill_moves_rating,
    sourceUrl: `https://www.football-data.org/person/${suggestion.livePlayer.id}`,
    acceleration: template.acceleration,
    sprintSpeed: template.sprint_speed,
    finishing: template.finishing,
    shotPower: template.shot_power,
    longShots: template.long_shots,
    positioning: template.positioning,
    volleys: template.volleys,
    penalties: template.penalties,
    vision: template.vision,
    crossing: template.crossing,
    freeKickAccuracy: template.free_kick_accuracy,
    shortPassing: template.short_passing,
    longPassing: template.long_passing,
    curve: template.curve,
    dribbling: template.dribbling,
    agility: template.agility,
    balance: template.balance,
    reactions: template.reactions,
    ballControl: template.ball_control,
    composure: template.composure,
    interceptions: template.interceptions,
    headingAccuracy: template.heading_accuracy,
    defensiveAwareness: template.defensive_awareness,
    standingTackle: template.standing_tackle,
    slidingTackle: template.sliding_tackle,
    jumping: template.jumping,
    stamina: template.stamina,
    strength: template.strength,
    aggression: template.aggression,
    gkDiving: suggestion.proposed.position === "GK" ? (template.gk_diving ?? 50) : null,
    gkHandling: suggestion.proposed.position === "GK" ? (template.gk_handling ?? 50) : null,
    gkKicking: suggestion.proposed.position === "GK" ? (template.gk_kicking ?? 50) : null,
    gkPositioning: suggestion.proposed.position === "GK" ? (template.gk_positioning ?? 50) : null,
    gkReflexes: suggestion.proposed.position === "GK" ? (template.gk_reflexes ?? 50) : null,
    nowIso
  });

  db.prepare(
    `
      INSERT INTO fc25_squads (
        dataset_version_id, club_id, player_id, squad_role, shirt_number, sort_order,
        overall, created_at, updated_at
      )
      VALUES (?, ?, ?, 'reserve', ?, ?, ?, ?, ?)
    `
  ).run(
    datasetVersionId,
    clubId,
    playerId,
    suggestion.proposed.shirtNumber ?? suggestion.livePlayer.shirtNumber ?? null,
    nextSortOrder,
    overall,
    nowIso,
    nowIso
  );
}

function applyPlayerRemoval(
  db: SqliteDatabase,
  datasetVersionId: string,
  clubId: Fc25ClubId,
  suggestion: Extract<SquadManagerSuggestion, { type: "player_removal" }>,
  nowIso: string
): void {
  assertPlayerExists(db, datasetVersionId, suggestion.playerId);
  const result = db
    .prepare<[string, string, string, string]>(
      `
        UPDATE fc25_squads
        SET squad_role = 'reserve', updated_at = ?
        WHERE dataset_version_id = ? AND club_id = ? AND player_id = ?
      `
    )
    .run(nowIso, datasetVersionId, clubId, suggestion.playerId);

  if (result.changes !== 1) {
    throw new Error(
      `Player '${suggestion.playerId}' is not in club '${clubId}' for dataset '${datasetVersionId}'`
    );
  }
}

function validateSuggestion(suggestion: SquadManagerSuggestion): void {
  if (!suggestion.suggestionId.trim()) {
    throw new Error("Suggestion id is required");
  }

  if (suggestion.type === "player_update") {
    if (
      suggestion.changes.age !== undefined &&
      (!Number.isInteger(suggestion.changes.age) || suggestion.changes.age <= 0)
    ) {
      throw new Error("Player age must be a positive integer");
    }
  }

  if (suggestion.type === "player_addition") {
    if (!Number.isInteger(suggestion.livePlayer.id) || suggestion.livePlayer.id <= 0) {
      throw new Error("Live player id must be a positive integer");
    }
    if (!Number.isInteger(suggestion.proposed.age) || suggestion.proposed.age <= 0) {
      throw new Error("Added player age must be a positive integer");
    }
  }
}

function templateForPosition(
  db: SqliteDatabase,
  datasetVersionId: string,
  clubId: Fc25ClubId,
  position: Fc25Position
): TemplatePlayerRow {
  const row =
    db
      .prepare<[string, string, string], TemplatePlayerRow>(
        `
          SELECT player.*
          FROM fc25_squads AS squad
          JOIN fc25_players AS player
            ON player.dataset_version_id = squad.dataset_version_id
            AND player.id = squad.player_id
          WHERE squad.dataset_version_id = ?
            AND squad.club_id = ?
            AND player.position = ?
          ORDER BY player.overall, player.rank DESC
          LIMIT 1
        `
      )
      .get(datasetVersionId, clubId, position) ??
    db
      .prepare<[string, string], TemplatePlayerRow>(
        `
          SELECT player.*
          FROM fc25_squads AS squad
          JOIN fc25_players AS player
            ON player.dataset_version_id = squad.dataset_version_id
            AND player.id = squad.player_id
          WHERE squad.dataset_version_id = ?
            AND squad.club_id = ?
          ORDER BY player.overall, player.rank DESC
          LIMIT 1
        `
      )
      .get(datasetVersionId, clubId);

  if (!row) {
    throw new Error(`No template player is available for club '${clubId}'`);
  }

  const averages = db
    .prepare<[string, string], AverageRow>(
      `
        SELECT AVG(player.overall) AS average_overall, AVG(player.rank) AS average_rank
        FROM fc25_squads AS squad
        JOIN fc25_players AS player
          ON player.dataset_version_id = squad.dataset_version_id
          AND player.id = squad.player_id
        WHERE squad.dataset_version_id = ?
          AND squad.club_id = ?
      `
    )
    .get(datasetVersionId, clubId);

  return {
    ...row,
    overall: Math.round(averages?.average_overall ?? row.overall),
    rank: Math.max(1, Math.round(averages?.average_rank ?? row.rank))
  };
}

function nextSquadSortOrder(
  db: SqliteDatabase,
  datasetVersionId: string,
  clubId: Fc25ClubId
): number {
  const row = db
    .prepare<[string, string], { max_sort_order: number | null }>(
      "SELECT MAX(sort_order) AS max_sort_order FROM fc25_squads WHERE dataset_version_id = ? AND club_id = ?"
    )
    .get(datasetVersionId, clubId);

  return (row?.max_sort_order ?? -1) + 1;
}

function activateFc25DatasetVersion(
  db: SqliteDatabase,
  datasetVersionId: string,
  nowIso: string
): void {
  db.prepare(
    "UPDATE fc25_dataset_versions SET is_active = 0, updated_at = ? WHERE is_active = 1"
  ).run(nowIso);
  db.prepare("UPDATE fc25_dataset_versions SET is_active = 1, updated_at = ? WHERE id = ?").run(
    nowIso,
    datasetVersionId
  );
}

function assertPlayerExists(db: SqliteDatabase, datasetVersionId: string, playerId: string): void {
  if (!playerExists(db, datasetVersionId, playerId)) {
    throw new Error(`Player '${playerId}' does not exist in dataset '${datasetVersionId}'`);
  }
}

function playerExists(db: SqliteDatabase, datasetVersionId: string, playerId: string): boolean {
  const row = db
    .prepare<[string, string], ExistingPlayerRow>(
      "SELECT id, overall FROM fc25_players WHERE dataset_version_id = ? AND id = ?"
    )
    .get(datasetVersionId, playerId);
  return Boolean(row);
}

function describeAppliedSuggestions(
  suggestions: SquadManagerSuggestion[],
  rationale: string | undefined
): string {
  const prefix = rationale?.trim() ? `${rationale.trim()}\n\n` : "";
  const counts = suggestions.reduce(
    (current, suggestion) => ({
      updated: current.updated + (suggestion.type === "player_update" ? 1 : 0),
      added: current.added + (suggestion.type === "player_addition" ? 1 : 0),
      removed: current.removed + (suggestion.type === "player_removal" ? 1 : 0)
    }),
    { updated: 0, added: 0, removed: 0 }
  );

  return `${prefix}Applied via squad-manager: ${suggestions.length} accepted suggestions (${counts.updated} updates, ${counts.added} additions, ${counts.removed} removals). IDs: ${suggestions
    .map((suggestion) => suggestion.suggestionId)
    .join(", ")}`;
}

function createSquadManagerVersionId(now: Date): string {
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `fc25-squad-manager-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function shortNameFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return name.trim();
  }

  return `${parts[0]?.[0] ?? ""}. ${parts.at(-1)}`;
}

function mapDatasetVersionRow(row: Fc25DatasetVersionRow): Fc25DatasetVersion {
  return {
    ...row,
    is_active: row.is_active === 1
  };
}
