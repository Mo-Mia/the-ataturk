import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { getDb, getDatabasePath, type SqliteDatabase } from "../db";
import { migrate } from "../migrate";
import { resolveRepoPath } from "../paths";
import type {
  Fc25Club,
  Fc25ClubId,
  Fc25DatasetVersion,
  Fc25ParsedPlayerRow,
  Fc25Position,
  Fc25PreferredFoot,
  Fc25SquadPlayer,
  Fc25StarRating
} from "../types";
import { adaptFc25RowToPlayerInputV2 } from "./adapter";
import { FC25_CLUBS, FC25_SOURCE_FILE_DEFAULT } from "./constants";
import { parseFc25PlayersCsv } from "./parser";

const DEFAULT_SQUAD_CAP = 25;
const STARTER_COUNT = 11;
const SUB_COUNT = 7;

export interface Fc25ImportOptions {
  csvPath?: string;
  databasePath?: string;
  name?: string;
  datasetVersionId?: string;
  squadCap?: number;
  now?: Date;
}

export interface Fc25ImportResult {
  datasetVersionId: string;
  databasePath: string;
  sourceFile: string;
  sourceFileSha256: string;
  clubs: number;
  players: number;
  squads: number;
}

export interface Fc25LoadedSquad {
  datasetVersionId: string;
  clubId: Fc25ClubId;
  clubName: string;
  shortName: string;
  players: Fc25SquadPlayer[];
}

interface Fc25DatasetVersionRow extends Omit<Fc25DatasetVersion, "is_active"> {
  is_active: number;
}

interface Fc25PlayerDbRow {
  dataset_version_id: string;
  id: string;
  fc25_player_id: string;
  name: string;
  short_name: string;
  overall: number;
  rank: number;
  position: Fc25Position;
  alternative_positions: string;
  age: number;
  nationality: string;
  height_cm: number;
  weight_kg: number;
  preferred_foot: Fc25PreferredFoot;
  weak_foot_rating: Fc25StarRating;
  skill_moves_rating: Fc25StarRating;
  source_url: string;
  play_style: string | null;
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
  shirt_number: number | null;
}

type Fc25ClubRow = Fc25Club;

export function importFc25Dataset(options: Fc25ImportOptions = {}): Fc25ImportResult {
  const csvPath = resolveRepoPath(options.csvPath ?? FC25_SOURCE_FILE_DEFAULT);
  const sourceCsv = readFileSync(csvPath, "utf8");
  const sourceFileSha256 = createHash("sha256").update(sourceCsv).digest("hex");
  const parsedRows = parseFc25PlayersCsv(sourceCsv);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const datasetVersionId =
    options.datasetVersionId ?? createDatasetVersionId(now, sourceFileSha256);
  const squadCap = options.squadCap ?? DEFAULT_SQUAD_CAP;
  const selectedRows = selectRowsForImport(parsedRows, squadCap);
  migrate(options.databasePath ? { databasePath: options.databasePath } : {});
  const db = getDb(options.databasePath);

  const importDataset = db.transaction(() => {
    insertDatasetVersion(db, {
      id: datasetVersionId,
      name: options.name ?? `FC25 ${basename(csvPath)} ${nowIso}`,
      sourceFile: csvPath,
      sourceFileSha256,
      nowIso
    });
    insertClubs(db, datasetVersionId, nowIso);
    const counts = insertSelectedRows(db, datasetVersionId, selectedRows, nowIso);
    activateDatasetVersion(db, datasetVersionId, nowIso);
    return counts;
  });

  const counts = importDataset();

  return {
    datasetVersionId,
    databasePath: getDatabasePath(options.databasePath),
    sourceFile: csvPath,
    sourceFileSha256,
    clubs: FC25_CLUBS.length,
    players: counts.players,
    squads: counts.squads
  };
}

export function getActiveFc25DatasetVersion(db = getDb()): Fc25DatasetVersion | null {
  const row =
    db
      .prepare<[], Fc25DatasetVersionRow>(
        "SELECT * FROM fc25_dataset_versions WHERE is_active = 1 LIMIT 1"
      )
      .get() ?? null;

  return row ? mapDatasetVersionRow(row) : null;
}

export function listFc25Clubs(
  datasetVersionId = getActiveFc25DatasetVersion()?.id,
  db = getDb()
): Fc25Club[] {
  if (!datasetVersionId) {
    return [];
  }

  return db
    .prepare<[string], Fc25ClubRow>(
      "SELECT * FROM fc25_clubs WHERE dataset_version_id = ? ORDER BY name"
    )
    .all(datasetVersionId);
}

export function loadFc25Squad(
  clubId: Fc25ClubId,
  datasetVersionId = getActiveFc25DatasetVersion()?.id,
  options: { include?: "starters" | "all"; db?: SqliteDatabase } = {}
): Fc25LoadedSquad {
  const db = options.db ?? getDb();
  if (!datasetVersionId) {
    throw new Error("No active FC25 dataset version is available");
  }

  const club =
    db
      .prepare<[string, string], Fc25ClubRow>(
        "SELECT * FROM fc25_clubs WHERE dataset_version_id = ? AND id = ?"
      )
      .get(datasetVersionId, clubId) ?? null;

  if (!club) {
    throw new Error(`Unknown FC25 club '${clubId}' in dataset '${datasetVersionId}'`);
  }

  const roleFilter = options.include === "all" ? "" : "AND squad.squad_role = 'starter'";
  const rows = db
    .prepare<[string, string], Fc25PlayerDbRow>(
      `
        SELECT player.*, squad.shirt_number
        FROM fc25_squads AS squad
        JOIN fc25_players AS player
          ON player.dataset_version_id = squad.dataset_version_id
          AND player.id = squad.player_id
        WHERE squad.dataset_version_id = ?
          AND squad.club_id = ?
          ${roleFilter}
        ORDER BY squad.sort_order, player.name
      `
    )
    .all(datasetVersionId, clubId);

  return {
    datasetVersionId,
    clubId,
    clubName: club.name,
    shortName: club.short_name,
    players: rows.map(mapPlayerRowToV2)
  };
}

export function parseFc25ImportCliArgs(args: string[]): Fc25ImportOptions {
  const options: Fc25ImportOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const next = args[index + 1];

    switch (arg) {
      case "--":
        break;
      case "--csv":
        options.csvPath = requireCliValue(arg, next);
        index += 1;
        break;
      case "--database":
        options.databasePath = requireCliValue(arg, next);
        index += 1;
        break;
      case "--name":
        options.name = requireCliValue(arg, next);
        index += 1;
        break;
      case "--version-id":
        options.datasetVersionId = requireCliValue(arg, next);
        index += 1;
        break;
      case "--cap":
        options.squadCap = parseCliPositiveInteger(arg, requireCliValue(arg, next));
        index += 1;
        break;
      default:
        throw new Error(`Unknown FC25 import option '${arg}'`);
    }
  }

  return options;
}

function selectRowsForImport(
  rows: Fc25ParsedPlayerRow[],
  squadCap: number
): Array<{ clubId: Fc25ClubId; row: Fc25ParsedPlayerRow; squadIndex: number }> {
  return FC25_CLUBS.flatMap((club) => {
    const clubRows = rows
      .filter((row) => row.sourceTeam === club.sourceTeam && row.league === club.league)
      .sort(compareRowsForSquad);

    if (clubRows.length === 0) {
      throw new Error(`No FC25 rows found for required club '${club.sourceTeam}'`);
    }

    return clubRows.slice(0, squadCap).map((row, squadIndex) => ({
      clubId: club.id,
      row,
      squadIndex
    }));
  });
}

function compareRowsForSquad(a: Fc25ParsedPlayerRow, b: Fc25ParsedPlayerRow): number {
  return b.overall - a.overall || a.rank - b.rank || a.sourceIndex - b.sourceIndex;
}

function insertDatasetVersion(
  db: SqliteDatabase,
  input: {
    id: string;
    name: string;
    sourceFile: string;
    sourceFileSha256: string;
    nowIso: string;
  }
): void {
  db.prepare(
    `
      INSERT INTO fc25_dataset_versions (
        id, name, source_file, source_file_sha256, is_active, created_at, updated_at
      )
      VALUES (@id, @name, @sourceFile, @sourceFileSha256, 0, @nowIso, @nowIso)
    `
  ).run(input);
}

function insertClubs(db: SqliteDatabase, datasetVersionId: string, nowIso: string): void {
  const insertClub = db.prepare(
    `
      INSERT INTO fc25_clubs (
        dataset_version_id, id, name, short_name, country, league, fc25_team_id,
        created_at, updated_at
      )
      VALUES (
        @datasetVersionId, @id, @name, @shortName, @country, @league, @sourceTeam,
        @nowIso, @nowIso
      )
    `
  );

  for (const club of FC25_CLUBS) {
    insertClub.run({
      datasetVersionId,
      ...club,
      nowIso
    });
  }
}

function insertSelectedRows(
  db: SqliteDatabase,
  datasetVersionId: string,
  selectedRows: Array<{ clubId: Fc25ClubId; row: Fc25ParsedPlayerRow; squadIndex: number }>,
  nowIso: string
): { players: number; squads: number } {
  const insertPlayer = db.prepare(
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
        @alternativePositions, @age, @nationality, @heightCm, @weightKg, @preferredFoot,
        @weakFootRating, @skillMovesRating, @sourceUrl, @playStyle,
        @acceleration, @sprintSpeed, @finishing, @shotPower, @longShots, @positioning,
        @volleys, @penalties, @vision, @crossing, @freeKickAccuracy, @shortPassing,
        @longPassing, @curve, @dribbling, @agility, @balance, @reactions, @ballControl,
        @composure, @interceptions, @headingAccuracy, @defensiveAwareness, @standingTackle,
        @slidingTackle, @jumping, @stamina, @strength, @aggression,
        @gkDiving, @gkHandling, @gkKicking, @gkPositioning, @gkReflexes,
        @nowIso, @nowIso
      )
    `
  );
  const insertSquad = db.prepare(
    `
      INSERT INTO fc25_squads (
        dataset_version_id, club_id, player_id, squad_role, shirt_number, sort_order,
        overall, created_at, updated_at
      )
      VALUES (
        @datasetVersionId, @clubId, @playerId, @squadRole, NULL, @sortOrder,
        @overall, @nowIso, @nowIso
      )
    `
  );
  const insertedPlayerIds = new Set<string>();
  let squadCount = 0;

  for (const { clubId, row, squadIndex } of selectedRows) {
    if (!insertedPlayerIds.has(row.fc25PlayerId)) {
      insertPlayer.run(playerInsertParams(datasetVersionId, row, nowIso));
      insertedPlayerIds.add(row.fc25PlayerId);
    }

    insertSquad.run({
      datasetVersionId,
      clubId,
      playerId: row.fc25PlayerId,
      squadRole: roleForSquadIndex(squadIndex),
      sortOrder: squadIndex,
      overall: row.overall,
      nowIso
    });
    squadCount += 1;
  }

  return { players: insertedPlayerIds.size, squads: squadCount };
}

function playerInsertParams(datasetVersionId: string, row: Fc25ParsedPlayerRow, nowIso: string) {
  const player = adaptFc25RowToPlayerInputV2(row);

  return {
    datasetVersionId,
    id: row.fc25PlayerId,
    fc25PlayerId: row.fc25PlayerId,
    name: row.name,
    shortName: player.shortName,
    overall: row.overall,
    rank: row.rank,
    position: row.position,
    alternativePositions: JSON.stringify(row.alternativePositions),
    age: row.age,
    nationality: row.nationality,
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    preferredFoot: row.preferredFoot,
    weakFootRating: row.weakFootRating,
    skillMovesRating: row.skillMovesRating,
    sourceUrl: row.sourceUrl,
    playStyle: row.playStyle,
    acceleration: row.attributes.acceleration,
    sprintSpeed: row.attributes.sprintSpeed,
    finishing: row.attributes.finishing,
    shotPower: row.attributes.shotPower,
    longShots: row.attributes.longShots,
    positioning: row.attributes.positioning,
    volleys: row.attributes.volleys,
    penalties: row.attributes.penalties,
    vision: row.attributes.vision,
    crossing: row.attributes.crossing,
    freeKickAccuracy: row.attributes.freeKickAccuracy,
    shortPassing: row.attributes.shortPassing,
    longPassing: row.attributes.longPassing,
    curve: row.attributes.curve,
    dribbling: row.attributes.dribbling,
    agility: row.attributes.agility,
    balance: row.attributes.balance,
    reactions: row.attributes.reactions,
    ballControl: row.attributes.ballControl,
    composure: row.attributes.composure,
    interceptions: row.attributes.interceptions,
    headingAccuracy: row.attributes.headingAccuracy,
    defensiveAwareness: row.attributes.defensiveAwareness,
    standingTackle: row.attributes.standingTackle,
    slidingTackle: row.attributes.slidingTackle,
    jumping: row.attributes.jumping,
    stamina: row.attributes.stamina,
    strength: row.attributes.strength,
    aggression: row.attributes.aggression,
    gkDiving: row.gkAttributes?.gkDiving ?? null,
    gkHandling: row.gkAttributes?.gkHandling ?? null,
    gkKicking: row.gkAttributes?.gkKicking ?? null,
    gkPositioning: row.gkAttributes?.gkPositioning ?? null,
    gkReflexes: row.gkAttributes?.gkReflexes ?? null,
    nowIso
  };
}

function roleForSquadIndex(index: number): "starter" | "sub" | "reserve" {
  if (index < STARTER_COUNT) {
    return "starter";
  }
  return index < STARTER_COUNT + SUB_COUNT ? "sub" : "reserve";
}

function activateDatasetVersion(db: SqliteDatabase, datasetVersionId: string, nowIso: string): void {
  db.prepare("UPDATE fc25_dataset_versions SET is_active = 0, updated_at = ? WHERE is_active = 1").run(
    nowIso
  );
  db.prepare("UPDATE fc25_dataset_versions SET is_active = 1, updated_at = ? WHERE id = ?").run(
    nowIso,
    datasetVersionId
  );
}

function createDatasetVersionId(now: Date, sourceFileSha256: string): string {
  const timestamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `fc25-${timestamp}-${sourceFileSha256.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
}

function mapDatasetVersionRow(row: Fc25DatasetVersionRow): Fc25DatasetVersion {
  return {
    ...row,
    is_active: row.is_active === 1
  };
}

function mapPlayerRowToV2(row: Fc25PlayerDbRow): Fc25SquadPlayer {
  const player: Fc25SquadPlayer = {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    ...(row.shirt_number === null ? {} : { squadNumber: row.shirt_number }),
    position: row.position,
    height: row.height_cm,
    weight: row.weight_kg,
    age: row.age,
    preferredFoot: row.preferred_foot,
    weakFootRating: row.weak_foot_rating,
    skillMovesRating: row.skill_moves_rating,
    overall: row.overall,
    sourcePosition: row.position,
    alternativePositions: parseAlternativePositions(row.alternative_positions),
    attributes: {
      acceleration: row.acceleration,
      sprintSpeed: row.sprint_speed,
      finishing: row.finishing,
      shotPower: row.shot_power,
      longShots: row.long_shots,
      positioning: row.positioning,
      volleys: row.volleys,
      penalties: row.penalties,
      vision: row.vision,
      crossing: row.crossing,
      freeKickAccuracy: row.free_kick_accuracy,
      shortPassing: row.short_passing,
      longPassing: row.long_passing,
      curve: row.curve,
      dribbling: row.dribbling,
      agility: row.agility,
      balance: row.balance,
      reactions: row.reactions,
      ballControl: row.ball_control,
      composure: row.composure,
      interceptions: row.interceptions,
      headingAccuracy: row.heading_accuracy,
      defensiveAwareness: row.defensive_awareness,
      standingTackle: row.standing_tackle,
      slidingTackle: row.sliding_tackle,
      jumping: row.jumping,
      stamina: row.stamina,
      strength: row.strength,
      aggression: row.aggression
    }
  };

  if (row.position === "GK") {
    player.gkAttributes = {
      gkDiving: requireNumber(row.gk_diving, "gk_diving"),
      gkHandling: requireNumber(row.gk_handling, "gk_handling"),
      gkKicking: requireNumber(row.gk_kicking, "gk_kicking"),
      gkPositioning: requireNumber(row.gk_positioning, "gk_positioning"),
      gkReflexes: requireNumber(row.gk_reflexes, "gk_reflexes")
    };
  }

  return player;
}

function parseAlternativePositions(value: string): Fc25Position[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((position): position is Fc25Position => typeof position === "string")
    : [];
}

function requireNumber(value: number | null, fieldName: string): number {
  if (value === null) {
    throw new Error(`Expected ${fieldName} to be non-null`);
  }
  return value;
}

function requireCliValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function parseCliPositiveInteger(option: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}

function isCliEntrypoint(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isCliEntrypoint()) {
  try {
    const result = importFc25Dataset(parseFc25ImportCliArgs(process.argv.slice(2)));
    console.log(
      `Imported FC25 dataset ${result.datasetVersionId}: ${result.clubs} clubs, ${result.players} players, ${result.squads} squad rows into ${result.databasePath}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
