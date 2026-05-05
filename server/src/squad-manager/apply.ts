import { createHash, randomUUID } from "node:crypto";

import {
  displayNameForFc25Player,
  getActiveFc25DatasetVersion,
  getDb,
  getFc25DatasetVersion,
  type Fc25ClubId,
  type Fc25DatasetVersion,
  type SquadManagerSuggestion
} from "@the-ataturk/data";

export type ApplyRiskLevel = "low";
type SqliteDatabase = ReturnType<typeof getDb>;

export interface ApplyLowRiskSquadManagerInput {
  clubId: Fc25ClubId;
  datasetVersionId: string;
  riskLevel: ApplyRiskLevel;
  suggestions: SquadManagerSuggestion[];
  verifyFresh?: boolean;
  actor?: string;
  now?: Date;
  db?: SqliteDatabase;
}

export interface ApplyLowRiskSquadManagerResult {
  newDatasetVersionId: string;
  activated: false;
  idempotent: boolean;
  summary: {
    applied: number;
    updated: number;
    added: 0;
    removed: 0;
  };
  audit: SquadManagerApplyAudit;
}

export interface SquadManagerApplyAudit {
  kind: "squad-manager-apply";
  schemaVersion: 1;
  sourceDatasetVersionId: string;
  clubId: Fc25ClubId;
  riskLevel: ApplyRiskLevel;
  suggestionIds: string[];
  suggestions: SquadManagerSuggestion[];
  payloadHash: string;
  appliedAt: string;
  actor: string;
  verifyFresh: boolean;
}

type LowRiskPlayerUpdate = Extract<SquadManagerSuggestion, { type: "player_update" }>;

interface DatasetVersionRow extends Omit<Fc25DatasetVersion, "is_active"> {
  is_active: number;
}

interface ClubRow {
  club_id: string;
}

interface PlayerNameRow {
  source_short_name: string | null;
}

const applyLocks = new Set<string>();
const LOW_RISK_CHANGE_FIELDS = ["age", "name", "nationality"] as const;

export function applyLowRiskSquadManagerSuggestions(
  input: ApplyLowRiskSquadManagerInput
): ApplyLowRiskSquadManagerResult {
  const db = input.db ?? getDb();
  const now = input.now ?? new Date();
  const appliedAt = now.toISOString();
  const actor = input.actor ?? "squad-manager-ui";
  const normalisedSuggestions = normaliseLowRiskSuggestions(input.suggestions);
  const payloadHash = hashPayload({
    sourceDatasetVersionId: input.datasetVersionId,
    clubId: input.clubId,
    riskLevel: input.riskLevel,
    suggestions: normalisedSuggestions
  });
  const lockKey = `${input.datasetVersionId}:${input.clubId}`;

  if (applyLocks.has(lockKey)) {
    throw new SquadManagerApplyConflictError(
      `Squad Manager apply is already running for '${input.clubId}' on '${input.datasetVersionId}'`
    );
  }

  applyLocks.add(lockKey);
  try {
    validateApplyInput(input, normalisedSuggestions, db);

    const existing = findExistingAppliedVersion(db, payloadHash);
    if (existing) {
      return {
        newDatasetVersionId: existing.version.id,
        activated: false,
        idempotent: true,
        summary: {
          applied: existing.audit.suggestions.length,
          updated: existing.audit.suggestions.length,
          added: 0,
          removed: 0
        },
        audit: existing.audit
      };
    }

    const sourceVersion = getFc25DatasetVersion(input.datasetVersionId, db);
    if (!sourceVersion) {
      throw new Error(`FC25 dataset version '${input.datasetVersionId}' does not exist`);
    }

    const audit: SquadManagerApplyAudit = {
      kind: "squad-manager-apply",
      schemaVersion: 1,
      sourceDatasetVersionId: input.datasetVersionId,
      clubId: input.clubId,
      riskLevel: input.riskLevel,
      suggestionIds: normalisedSuggestions.map((suggestion) => suggestion.suggestionId),
      suggestions: normalisedSuggestions,
      payloadHash,
      appliedAt,
      actor,
      verifyFresh: input.verifyFresh ?? false
    };
    const newDatasetVersionId = createAppliedVersionId(now);

    const applyTransaction = db.transaction(() => {
      insertVersionCopy(db, {
        sourceVersion,
        newDatasetVersionId,
        audit,
        nowIso: appliedAt
      });
      copyVersionRows(db, input.datasetVersionId, newDatasetVersionId, appliedAt);
      for (const suggestion of normalisedSuggestions) {
        applyPlayerUpdate(db, newDatasetVersionId, suggestion, appliedAt);
      }
    });

    applyTransaction();

    return {
      newDatasetVersionId,
      activated: false,
      idempotent: false,
      summary: {
        applied: normalisedSuggestions.length,
        updated: normalisedSuggestions.length,
        added: 0,
        removed: 0
      },
      audit
    };
  } finally {
    applyLocks.delete(lockKey);
  }
}

export function activateFc25DatasetVersionForSquadManager(
  datasetVersionId: string,
  db = getDb(),
  now = new Date()
): Fc25DatasetVersion {
  const nowIso = now.toISOString();
  const activate = db.transaction(() => {
    const version = getFc25DatasetVersion(datasetVersionId, db);
    if (!version) {
      throw new Error(`FC25 dataset version '${datasetVersionId}' does not exist`);
    }

    db.prepare(
      "UPDATE fc25_dataset_versions SET is_active = 0, updated_at = ? WHERE is_active = 1"
    ).run(nowIso);
    db.prepare("UPDATE fc25_dataset_versions SET is_active = 1, updated_at = ? WHERE id = ?").run(
      nowIso,
      datasetVersionId
    );
  });

  activate();

  const activated = getFc25DatasetVersion(datasetVersionId, db);
  if (!activated) {
    throw new Error(`FC25 dataset version '${datasetVersionId}' does not exist after activation`);
  }
  return activated;
}

export function parseSquadManagerApplyAudit(
  description: string | null | undefined
): SquadManagerApplyAudit | null {
  if (!description) {
    return null;
  }

  try {
    const parsed = JSON.parse(description) as unknown;
    if (!isRecord(parsed) || parsed.kind !== "squad-manager-apply") {
      return null;
    }
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.sourceDatasetVersionId !== "string" ||
      typeof parsed.clubId !== "string" ||
      parsed.riskLevel !== "low" ||
      !Array.isArray(parsed.suggestionIds) ||
      !Array.isArray(parsed.suggestions) ||
      typeof parsed.payloadHash !== "string" ||
      typeof parsed.appliedAt !== "string" ||
      typeof parsed.actor !== "string" ||
      typeof parsed.verifyFresh !== "boolean"
    ) {
      return null;
    }
    return parsed as unknown as SquadManagerApplyAudit;
  } catch {
    return null;
  }
}

export class SquadManagerApplyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SquadManagerApplyConflictError";
  }
}

function validateApplyInput(
  input: ApplyLowRiskSquadManagerInput,
  suggestions: SquadManagerSuggestion[],
  db: SqliteDatabase
): asserts suggestions is LowRiskPlayerUpdate[] {
  if (input.riskLevel !== "low") {
    throw new Error("Only riskLevel 'low' can be applied in this sprint");
  }
  if (input.verifyFresh === true) {
    throw new Error("verifyFresh is reserved for future medium/high-risk apply paths");
  }
  if (suggestions.length === 0) {
    throw new Error("At least one low-risk suggestion is required");
  }

  const activeVersion = getActiveFc25DatasetVersion(db);
  if (!activeVersion || activeVersion.id !== input.datasetVersionId) {
    throw new Error(
      `Stale apply rejected: active FC25 dataset is '${activeVersion?.id ?? "none"}', not '${input.datasetVersionId}'`
    );
  }

  if (!getFc25DatasetVersion(input.datasetVersionId, db)) {
    throw new Error(`FC25 dataset version '${input.datasetVersionId}' does not exist`);
  }

  const seen = new Set<string>();
  for (const suggestion of suggestions) {
    if (seen.has(suggestion.suggestionId)) {
      throw new Error(`Duplicate suggestion '${suggestion.suggestionId}'`);
    }
    seen.add(suggestion.suggestionId);

    if (!isPlayerUpdateSuggestion(suggestion)) {
      throw new Error(`Suggestion '${suggestion.suggestionId}' is not a low-risk player update`);
    }
    const changeFields = Object.keys(suggestion.changes);
    if (changeFields.length === 0) {
      throw new Error(`Suggestion '${suggestion.suggestionId}' has no changes`);
    }
    const unsupported = changeFields.filter(
      (field) => !LOW_RISK_CHANGE_FIELDS.includes(field as (typeof LOW_RISK_CHANGE_FIELDS)[number])
    );
    if (unsupported.length > 0) {
      throw new Error(
        `Suggestion '${suggestion.suggestionId}' contains non-low-risk changes: ${unsupported.join(", ")}`
      );
    }

    assertPlayerBelongsToClub(db, input.datasetVersionId, input.clubId, suggestion.playerId);
    validateLowRiskChanges(suggestion);
  }
}

function normaliseLowRiskSuggestions(suggestions: SquadManagerSuggestion[]): SquadManagerSuggestion[] {
  return [...suggestions].sort((left, right) => left.suggestionId.localeCompare(right.suggestionId));
}

function validateLowRiskChanges(suggestion: LowRiskPlayerUpdate): void {
  if (suggestion.changes.name !== undefined && suggestion.changes.name.trim().length === 0) {
    throw new Error(`Suggestion '${suggestion.suggestionId}' name change must not be empty`);
  }
  if (
    suggestion.changes.age !== undefined &&
    (!Number.isInteger(suggestion.changes.age) || suggestion.changes.age <= 0)
  ) {
    throw new Error(`Suggestion '${suggestion.suggestionId}' age must be a positive integer`);
  }
  if (
    suggestion.changes.nationality !== undefined &&
    suggestion.changes.nationality.trim().length === 0
  ) {
    throw new Error(`Suggestion '${suggestion.suggestionId}' nationality must not be empty`);
  }
}

function assertPlayerBelongsToClub(
  db: SqliteDatabase,
  datasetVersionId: string,
  clubId: Fc25ClubId,
  playerId: string
): void {
  const row = db
    .prepare<[string, string, string], ClubRow>(
      `
        SELECT club_id
        FROM fc25_squads
        WHERE dataset_version_id = ? AND club_id = ? AND player_id = ?
      `
    )
    .get(datasetVersionId, clubId, playerId);

  if (!row) {
    throw new Error(
      `Player '${playerId}' does not belong to club '${clubId}' in dataset '${datasetVersionId}'`
    );
  }
}

function insertVersionCopy(
  db: SqliteDatabase,
  input: {
    sourceVersion: Fc25DatasetVersion;
    newDatasetVersionId: string;
    audit: SquadManagerApplyAudit;
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
    `${input.sourceVersion.name} via squad-manager low-risk apply`,
    `squad-manager:${input.sourceVersion.id}`,
    input.sourceVersion.source_file_sha256,
    JSON.stringify(input.audit),
    input.nowIso,
    input.nowIso
  );
}

function copyVersionRows(
  db: SqliteDatabase,
  sourceDatasetVersionId: string,
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
  ).run(newDatasetVersionId, nowIso, nowIso, sourceDatasetVersionId);

  db.prepare(
    `
      INSERT INTO fc25_players (
        dataset_version_id, id, fc25_player_id, name, short_name, source_name,
        source_short_name, display_name, overall, rank, position,
        alternative_positions, age, nationality, height_cm, weight_kg, preferred_foot,
        weak_foot_rating, skill_moves_rating, source_url, play_style,
        acceleration, sprint_speed, finishing, shot_power, long_shots, positioning,
        volleys, penalties, vision, crossing, free_kick_accuracy, short_passing,
        long_passing, curve, dribbling, agility, balance, reactions, ball_control,
        composure, interceptions, heading_accuracy, defensive_awareness, standing_tackle,
        sliding_tackle, jumping, stamina, strength, aggression,
        gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
        potential, value_eur, wage_eur, release_clause_eur, body_type, work_rate,
        international_reputation, player_traits, player_tags,
        category_pace, category_shooting, category_passing, category_dribbling,
        category_defending, category_physic, goalkeeping_speed, position_ratings_json,
        created_at, updated_at
      )
      SELECT
        ?, id, fc25_player_id, name, short_name, source_name,
        source_short_name, display_name, overall, rank, position,
        alternative_positions, age, nationality, height_cm, weight_kg, preferred_foot,
        weak_foot_rating, skill_moves_rating, source_url, play_style,
        acceleration, sprint_speed, finishing, shot_power, long_shots, positioning,
        volleys, penalties, vision, crossing, free_kick_accuracy, short_passing,
        long_passing, curve, dribbling, agility, balance, reactions, ball_control,
        composure, interceptions, heading_accuracy, defensive_awareness, standing_tackle,
        sliding_tackle, jumping, stamina, strength, aggression,
        gk_diving, gk_handling, gk_kicking, gk_positioning, gk_reflexes,
        potential, value_eur, wage_eur, release_clause_eur, body_type, work_rate,
        international_reputation, player_traits, player_tags,
        category_pace, category_shooting, category_passing, category_dribbling,
        category_defending, category_physic, goalkeeping_speed, position_ratings_json,
        ?, ?
      FROM fc25_players
      WHERE dataset_version_id = ?
    `
  ).run(newDatasetVersionId, nowIso, nowIso, sourceDatasetVersionId);

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
  ).run(newDatasetVersionId, nowIso, nowIso, sourceDatasetVersionId);
}

function applyPlayerUpdate(
  db: SqliteDatabase,
  datasetVersionId: string,
  suggestion: LowRiskPlayerUpdate,
  nowIso: string
): void {
  const changes: string[] = [];
  const params: Array<string | number> = [];

  if (suggestion.changes.name !== undefined) {
    const sourceName = suggestion.changes.name;
    const shortName = shortNameFor(sourceName);
    const sourceShortName = sourceShortNameFor(db, datasetVersionId, suggestion.playerId);
    changes.push("name = ?", "short_name = ?", "source_name = ?", "display_name = ?");
    params.push(
      sourceName,
      shortName,
      sourceName,
      displayNameForFc25Player({
        id: suggestion.playerId,
        sourceName,
        sourceShortName
      })
    );
  }
  if (suggestion.changes.nationality !== undefined) {
    changes.push("nationality = ?");
    params.push(suggestion.changes.nationality);
  }
  if (suggestion.changes.age !== undefined) {
    changes.push("age = ?");
    params.push(suggestion.changes.age);
  }

  params.push(nowIso, datasetVersionId, suggestion.playerId);
  const result = db.prepare(
    `
      UPDATE fc25_players
      SET ${changes.join(", ")}, updated_at = ?
      WHERE dataset_version_id = ? AND id = ?
    `
  ).run(...params);

  if (result.changes !== 1) {
    throw new Error(`Player '${suggestion.playerId}' does not exist in '${datasetVersionId}'`);
  }
}

function sourceShortNameFor(
  db: SqliteDatabase,
  datasetVersionId: string,
  playerId: string
): string | null {
  const row = db
    .prepare<[string, string], PlayerNameRow>(
      "SELECT source_short_name FROM fc25_players WHERE dataset_version_id = ? AND id = ?"
    )
    .get(datasetVersionId, playerId);
  return row?.source_short_name ?? null;
}

function findExistingAppliedVersion(
  db: SqliteDatabase,
  payloadHash: string
): { version: Fc25DatasetVersion; audit: SquadManagerApplyAudit } | null {
  const rows = db
    .prepare<[], DatasetVersionRow>(
      "SELECT * FROM fc25_dataset_versions ORDER BY created_at DESC, id"
    )
    .all();

  for (const row of rows) {
    const version = mapDatasetVersionRow(row);
    const audit = parseSquadManagerApplyAudit(version.description);
    if (audit?.payloadHash === payloadHash) {
      return { version, audit };
    }
  }

  return null;
}

function hashPayload(payload: {
  sourceDatasetVersionId: string;
  clubId: Fc25ClubId;
  riskLevel: ApplyRiskLevel;
  suggestions: SquadManagerSuggestion[];
}): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function createAppliedVersionId(now: Date): string {
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `fc25-squad-manager-low-${timestamp}-${randomUUID().slice(0, 8)}`;
}

function shortNameFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) {
    return name.trim();
  }
  return `${parts[0]?.[0] ?? ""}. ${parts.at(-1)}`;
}

function mapDatasetVersionRow(row: DatasetVersionRow): Fc25DatasetVersion {
  return {
    ...row,
    is_active: row.is_active === 1
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerUpdateSuggestion(
  suggestion: SquadManagerSuggestion
): suggestion is LowRiskPlayerUpdate {
  return suggestion.type === "player_update";
}
