import { parse } from "csv-parse/sync";

import {
  FC25_POSITIONS,
  FC25_SOURCE_POSITIONS,
  type Fc25GoalkeeperAttributes,
  type Fc25ParsedPlayerRow,
  type Fc25PlayerAttributes,
  type Fc25Position,
  type Fc25PreferredFoot,
  type Fc25SourcePosition,
  type Fc25StarRating
} from "../types";
import { FC25_SOURCE_TO_ENGINE_POSITION } from "./constants";

type CsvValue = string | undefined;
type Fc25CsvRecord = Record<string, CsvValue>;
export type Fc25CsvFormat = "fc25" | "fc26" | "auto";

const SOURCE_POSITIONS = new Set<string>(FC25_SOURCE_POSITIONS);
const ENGINE_POSITIONS = new Set<string>(FC25_POSITIONS);
const FC26_POSITION_RATING_FIELDS = [
  "ls",
  "st",
  "rs",
  "lw",
  "lf",
  "cf",
  "rf",
  "rw",
  "lam",
  "cam",
  "ram",
  "lm",
  "lcm",
  "cm",
  "rcm",
  "rm",
  "lwb",
  "ldm",
  "cdm",
  "rdm",
  "rwb",
  "lb",
  "lcb",
  "cb",
  "rcb",
  "rb",
  "gk"
] as const;

export class Fc25ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Fc25ParseError";
  }
}

export function parseFc25PlayersCsv(
  content: string,
  options: { format?: Fc25CsvFormat } = {}
): Fc25ParsedPlayerRow[] {
  const records = parse<Fc25CsvRecord>(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true
  });

  const format = resolveCsvFormat(records[0], options.format ?? "auto");
  return records.map((record, index) =>
    format === "fc26"
      ? parseFc26PlayerRecord(record, index + 2)
      : parseFc25PlayerRecord(record, index + 2)
  );
}

export function parseFc25PlayerRecord(
  record: Fc25CsvRecord,
  sourceLine: number
): Fc25ParsedPlayerRow {
  const sourcePosition = parseSourcePosition(required(record, "Position", sourceLine), sourceLine);
  const position = FC25_SOURCE_TO_ENGINE_POSITION[sourcePosition];

  return {
    sourceIndex: parseInteger(required(record, "Unnamed: 0", sourceLine), "Unnamed: 0", sourceLine),
    rank: parseInteger(required(record, "Rank", sourceLine), "Rank", sourceLine),
    fc25PlayerId: parsePlayerId(required(record, "url", sourceLine), sourceLine),
    name: required(record, "Name", sourceLine),
    sourceShortName: null,
    overall: parseRating(required(record, "OVR", sourceLine), "OVR", sourceLine),
    position,
    sourcePosition,
    alternativePositions: parseAlternativePositions(record["Alternative positions"] ?? "", sourceLine),
    age: parseInteger(required(record, "Age", sourceLine), "Age", sourceLine),
    nationality: required(record, "Nation", sourceLine),
    leagueId: null,
    league: required(record, "League", sourceLine),
    sourceTeam: required(record, "Team", sourceLine),
    preferredFoot: parsePreferredFoot(required(record, "Preferred foot", sourceLine), sourceLine),
    weakFootRating: parseStarRating(required(record, "Weak foot", sourceLine), "Weak foot", sourceLine),
    skillMovesRating: parseStarRating(
      required(record, "Skill moves", sourceLine),
      "Skill moves",
      sourceLine
    ),
    heightCm: parseMetricPrefix(required(record, "Height", sourceLine), "Height", sourceLine),
    weightKg: parseMetricPrefix(required(record, "Weight", sourceLine), "Weight", sourceLine),
    playStyle: nullableText(record["play style"]),
    sourceUrl: required(record, "url", sourceLine),
    squadNumber: null,
    sourceSquadRole: null,
    fc26Metadata: null,
    attributes: parseAttributes(record, sourceLine),
    gkAttributes: position === "GK" ? parseGoalkeeperAttributes(record, sourceLine) : null
  };
}

export function parseFc26PlayerRecord(
  record: Fc25CsvRecord,
  sourceLine: number
): Fc25ParsedPlayerRow {
  const sourcePositions = parseFc26SourcePositions(
    required(record, "player_positions", sourceLine),
    sourceLine
  );
  const sourcePosition = sourcePositions[0]!;
  const position = FC25_SOURCE_TO_ENGINE_POSITION[sourcePosition];
  const alternativePositions = sourcePositions
    .slice(1)
    .map((value) => FC25_SOURCE_TO_ENGINE_POSITION[value]);

  return {
    sourceIndex: sourceLine - 1,
    rank: sourceLine - 1,
    fc25PlayerId: required(record, "player_id", sourceLine),
    name: required(record, "long_name", sourceLine),
    sourceShortName: required(record, "short_name", sourceLine),
    overall: parseRating(required(record, "overall", sourceLine), "overall", sourceLine),
    position,
    sourcePosition,
    alternativePositions,
    age: parseInteger(required(record, "age", sourceLine), "age", sourceLine),
    nationality: required(record, "nationality_name", sourceLine),
    leagueId: nullableInteger(record.league_id, "league_id", sourceLine),
    league: nullableText(record.league_name) ?? "",
    sourceTeam: nullableText(record.club_name) ?? "",
    preferredFoot: parsePreferredFoot(required(record, "preferred_foot", sourceLine), sourceLine),
    weakFootRating: parseStarRating(required(record, "weak_foot", sourceLine), "weak_foot", sourceLine),
    skillMovesRating: parseStarRating(
      required(record, "skill_moves", sourceLine),
      "skill_moves",
      sourceLine
    ),
    heightCm: parseInteger(required(record, "height_cm", sourceLine), "height_cm", sourceLine),
    weightKg: parseInteger(required(record, "weight_kg", sourceLine), "weight_kg", sourceLine),
    playStyle: nullableText(record.player_traits),
    sourceUrl: required(record, "player_url", sourceLine),
    squadNumber: nullableInteger(record.club_jersey_number, "club_jersey_number", sourceLine),
    sourceSquadRole: nullableText(record.club_position),
    fc26Metadata: {
      potential: nullableInteger(record.potential, "potential", sourceLine),
      valueEur: nullableInteger(record.value_eur, "value_eur", sourceLine),
      wageEur: nullableInteger(record.wage_eur, "wage_eur", sourceLine),
      releaseClauseEur: nullableInteger(record.release_clause_eur, "release_clause_eur", sourceLine),
      bodyType: nullableText(record.body_type),
      workRate: nullableText(record.work_rate),
      internationalReputation: nullableInteger(
        record.international_reputation,
        "international_reputation",
        sourceLine
      ),
      playerTraits: nullableText(record.player_traits),
      playerTags: nullableText(record.player_tags),
      categoryPace: nullableRating(record.pace, "pace", sourceLine),
      categoryShooting: nullableRating(record.shooting, "shooting", sourceLine),
      categoryPassing: nullableRating(record.passing, "passing", sourceLine),
      categoryDribbling: nullableRating(record.dribbling, "dribbling", sourceLine),
      categoryDefending: nullableRating(record.defending, "defending", sourceLine),
      categoryPhysic: nullableRating(record.physic, "physic", sourceLine),
      goalkeepingSpeed: nullableRating(record.goalkeeping_speed, "goalkeeping_speed", sourceLine),
      positionRatings: parseFc26PositionRatings(record, sourceLine)
    },
    attributes: parseFc26Attributes(record, sourceLine),
    gkAttributes: position === "GK" ? parseFc26GoalkeeperAttributes(record, sourceLine) : null
  };
}

function parseAttributes(record: Fc25CsvRecord, sourceLine: number): Fc25PlayerAttributes {
  return {
    acceleration: parseRating(required(record, "Acceleration", sourceLine), "Acceleration", sourceLine),
    sprintSpeed: parseRating(required(record, "Sprint Speed", sourceLine), "Sprint Speed", sourceLine),
    finishing: parseRating(required(record, "Finishing", sourceLine), "Finishing", sourceLine),
    shotPower: parseRating(required(record, "Shot Power", sourceLine), "Shot Power", sourceLine),
    longShots: parseRating(required(record, "Long Shots", sourceLine), "Long Shots", sourceLine),
    positioning: parseRating(required(record, "Positioning", sourceLine), "Positioning", sourceLine),
    volleys: parseRating(required(record, "Volleys", sourceLine), "Volleys", sourceLine),
    penalties: parseRating(required(record, "Penalties", sourceLine), "Penalties", sourceLine),
    vision: parseRating(required(record, "Vision", sourceLine), "Vision", sourceLine),
    crossing: parseRating(required(record, "Crossing", sourceLine), "Crossing", sourceLine),
    freeKickAccuracy: parseRating(
      required(record, "Free Kick Accuracy", sourceLine),
      "Free Kick Accuracy",
      sourceLine
    ),
    shortPassing: parseRating(
      required(record, "Short Passing", sourceLine),
      "Short Passing",
      sourceLine
    ),
    longPassing: parseRating(required(record, "Long Passing", sourceLine), "Long Passing", sourceLine),
    curve: parseRating(required(record, "Curve", sourceLine), "Curve", sourceLine),
    dribbling: parseRating(required(record, "Dribbling", sourceLine), "Dribbling", sourceLine),
    agility: parseRating(required(record, "Agility", sourceLine), "Agility", sourceLine),
    balance: parseRating(required(record, "Balance", sourceLine), "Balance", sourceLine),
    reactions: parseRating(required(record, "Reactions", sourceLine), "Reactions", sourceLine),
    ballControl: parseRating(required(record, "Ball Control", sourceLine), "Ball Control", sourceLine),
    composure: parseRating(required(record, "Composure", sourceLine), "Composure", sourceLine),
    interceptions: parseRating(
      required(record, "Interceptions", sourceLine),
      "Interceptions",
      sourceLine
    ),
    headingAccuracy: parseRating(
      required(record, "Heading Accuracy", sourceLine),
      "Heading Accuracy",
      sourceLine
    ),
    defensiveAwareness: parseRating(
      required(record, "Def Awareness", sourceLine),
      "Def Awareness",
      sourceLine
    ),
    standingTackle: parseRating(
      required(record, "Standing Tackle", sourceLine),
      "Standing Tackle",
      sourceLine
    ),
    slidingTackle: parseRating(
      required(record, "Sliding Tackle", sourceLine),
      "Sliding Tackle",
      sourceLine
    ),
    jumping: parseRating(required(record, "Jumping", sourceLine), "Jumping", sourceLine),
    stamina: parseRating(required(record, "Stamina", sourceLine), "Stamina", sourceLine),
    strength: parseRating(required(record, "Strength", sourceLine), "Strength", sourceLine),
    aggression: parseRating(required(record, "Aggression", sourceLine), "Aggression", sourceLine)
  };
}

function parseGoalkeeperAttributes(
  record: Fc25CsvRecord,
  sourceLine: number
): Fc25GoalkeeperAttributes {
  return {
    gkDiving: parseRating(required(record, "GK Diving", sourceLine), "GK Diving", sourceLine),
    gkHandling: parseRating(required(record, "GK Handling", sourceLine), "GK Handling", sourceLine),
    gkKicking: parseRating(required(record, "GK Kicking", sourceLine), "GK Kicking", sourceLine),
    gkPositioning: parseRating(
      required(record, "GK Positioning", sourceLine),
      "GK Positioning",
      sourceLine
    ),
    gkReflexes: parseRating(required(record, "GK Reflexes", sourceLine), "GK Reflexes", sourceLine)
  };
}

function parseFc26Attributes(record: Fc25CsvRecord, sourceLine: number): Fc25PlayerAttributes {
  return {
    acceleration: parseRating(
      required(record, "movement_acceleration", sourceLine),
      "movement_acceleration",
      sourceLine
    ),
    sprintSpeed: parseRating(
      required(record, "movement_sprint_speed", sourceLine),
      "movement_sprint_speed",
      sourceLine
    ),
    finishing: parseRating(
      required(record, "attacking_finishing", sourceLine),
      "attacking_finishing",
      sourceLine
    ),
    shotPower: parseRating(required(record, "power_shot_power", sourceLine), "power_shot_power", sourceLine),
    longShots: parseRating(required(record, "power_long_shots", sourceLine), "power_long_shots", sourceLine),
    positioning: parseRating(
      required(record, "mentality_positioning", sourceLine),
      "mentality_positioning",
      sourceLine
    ),
    volleys: parseRating(required(record, "attacking_volleys", sourceLine), "attacking_volleys", sourceLine),
    penalties: parseRating(
      required(record, "mentality_penalties", sourceLine),
      "mentality_penalties",
      sourceLine
    ),
    vision: parseRating(required(record, "mentality_vision", sourceLine), "mentality_vision", sourceLine),
    crossing: parseRating(
      required(record, "attacking_crossing", sourceLine),
      "attacking_crossing",
      sourceLine
    ),
    freeKickAccuracy: parseRating(
      required(record, "skill_fk_accuracy", sourceLine),
      "skill_fk_accuracy",
      sourceLine
    ),
    shortPassing: parseRating(
      required(record, "attacking_short_passing", sourceLine),
      "attacking_short_passing",
      sourceLine
    ),
    longPassing: parseRating(
      required(record, "skill_long_passing", sourceLine),
      "skill_long_passing",
      sourceLine
    ),
    curve: parseRating(required(record, "skill_curve", sourceLine), "skill_curve", sourceLine),
    dribbling: parseRating(required(record, "skill_dribbling", sourceLine), "skill_dribbling", sourceLine),
    agility: parseRating(required(record, "movement_agility", sourceLine), "movement_agility", sourceLine),
    balance: parseRating(required(record, "movement_balance", sourceLine), "movement_balance", sourceLine),
    reactions: parseRating(
      required(record, "movement_reactions", sourceLine),
      "movement_reactions",
      sourceLine
    ),
    ballControl: parseRating(
      required(record, "skill_ball_control", sourceLine),
      "skill_ball_control",
      sourceLine
    ),
    composure: parseRating(
      required(record, "mentality_composure", sourceLine),
      "mentality_composure",
      sourceLine
    ),
    interceptions: parseRating(
      required(record, "mentality_interceptions", sourceLine),
      "mentality_interceptions",
      sourceLine
    ),
    headingAccuracy: parseRating(
      required(record, "attacking_heading_accuracy", sourceLine),
      "attacking_heading_accuracy",
      sourceLine
    ),
    defensiveAwareness: parseRating(
      required(record, "defending_marking_awareness", sourceLine),
      "defending_marking_awareness",
      sourceLine
    ),
    standingTackle: parseRating(
      required(record, "defending_standing_tackle", sourceLine),
      "defending_standing_tackle",
      sourceLine
    ),
    slidingTackle: parseRating(
      required(record, "defending_sliding_tackle", sourceLine),
      "defending_sliding_tackle",
      sourceLine
    ),
    jumping: parseRating(required(record, "power_jumping", sourceLine), "power_jumping", sourceLine),
    stamina: parseRating(required(record, "power_stamina", sourceLine), "power_stamina", sourceLine),
    strength: parseRating(required(record, "power_strength", sourceLine), "power_strength", sourceLine),
    aggression: parseRating(
      required(record, "mentality_aggression", sourceLine),
      "mentality_aggression",
      sourceLine
    )
  };
}

function parseFc26GoalkeeperAttributes(
  record: Fc25CsvRecord,
  sourceLine: number
): Fc25GoalkeeperAttributes {
  return {
    gkDiving: parseRating(required(record, "goalkeeping_diving", sourceLine), "goalkeeping_diving", sourceLine),
    gkHandling: parseRating(
      required(record, "goalkeeping_handling", sourceLine),
      "goalkeeping_handling",
      sourceLine
    ),
    gkKicking: parseRating(required(record, "goalkeeping_kicking", sourceLine), "goalkeeping_kicking", sourceLine),
    gkPositioning: parseRating(
      required(record, "goalkeeping_positioning", sourceLine),
      "goalkeeping_positioning",
      sourceLine
    ),
    gkReflexes: parseRating(
      required(record, "goalkeeping_reflexes", sourceLine),
      "goalkeeping_reflexes",
      sourceLine
    )
  };
}

function parseFc26PositionRatings(
  record: Fc25CsvRecord,
  sourceLine: number
): Record<string, number> {
  return Object.fromEntries(
    FC26_POSITION_RATING_FIELDS.flatMap((field) => {
      const rating = nullablePositionRating(record[field], field, sourceLine);
      return rating === null ? [] : [[field, rating]];
    })
  );
}

function parseFc26SourcePositions(value: string, sourceLine: number): Fc25SourcePosition[] {
  const positions = value.split(",").map((position) => parseSourcePosition(position.trim(), sourceLine));
  if (positions.length === 0) {
    throw new Fc25ParseError(`Missing player_positions on CSV line ${sourceLine}`);
  }
  return positions;
}

function resolveCsvFormat(record: Fc25CsvRecord | undefined, format: Fc25CsvFormat): Exclude<Fc25CsvFormat, "auto"> {
  if (format !== "auto") {
    return format;
  }
  if (record && "player_id" in record && "player_positions" in record && "club_name" in record) {
    return "fc26";
  }
  return "fc25";
}

function required(record: Fc25CsvRecord, field: string, sourceLine: number): string {
  const value = record[field];
  if (value === undefined || value.trim().length === 0) {
    throw new Fc25ParseError(`Missing ${field} on CSV line ${sourceLine}`);
  }
  return value.trim();
}

function nullableText(value: CsvValue): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function parseInteger(value: string, field: string, sourceLine: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Fc25ParseError(`Invalid ${field} "${value}" on CSV line ${sourceLine}`);
  }
  return parsed;
}

function nullableInteger(value: CsvValue, field: string, sourceLine: number): number | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : parseInteger(trimmed, field, sourceLine);
}

function parseRating(value: string, field: string, sourceLine: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Fc25ParseError(`Invalid ${field} "${value}" on CSV line ${sourceLine}`);
  }
  return Math.round(parsed);
}

function nullableRating(value: CsvValue, field: string, sourceLine: number): number | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : parseRating(trimmed, field, sourceLine);
}

function nullablePositionRating(value: CsvValue, field: string, sourceLine: number): number | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  const match = /^(\d+)/.exec(trimmed);
  if (!match) {
    throw new Fc25ParseError(`Invalid ${field} "${value}" on CSV line ${sourceLine}`);
  }
  return parseRating(match[1]!, field, sourceLine);
}

function parseStarRating(value: string, field: string, sourceLine: number): Fc25StarRating {
  const parsed = parseInteger(value, field, sourceLine);
  if (parsed < 1 || parsed > 5) {
    throw new Fc25ParseError(`Invalid ${field} "${value}" on CSV line ${sourceLine}`);
  }
  return parsed as Fc25StarRating;
}

function parsePreferredFoot(value: string, sourceLine: number): Fc25PreferredFoot {
  const normalised = value.trim().toLowerCase();
  if (normalised === "left" || normalised === "right" || normalised === "either") {
    return normalised;
  }
  throw new Fc25ParseError(`Invalid Preferred foot "${value}" on CSV line ${sourceLine}`);
}

function parseSourcePosition(value: string, sourceLine: number): Fc25SourcePosition {
  if (SOURCE_POSITIONS.has(value)) {
    return value as Fc25SourcePosition;
  }
  throw new Fc25ParseError(`Invalid Position "${value}" on CSV line ${sourceLine}`);
}

function parseAlternativePositions(value: string, sourceLine: number): Fc25Position[] {
  if (value.trim().length === 0) {
    return [];
  }

  return value.split(",").map((position) => {
    const trimmed = position.trim();
    const mapped =
      SOURCE_POSITIONS.has(trimmed) ?
        FC25_SOURCE_TO_ENGINE_POSITION[trimmed as Fc25SourcePosition]
      : trimmed;

    if (!ENGINE_POSITIONS.has(mapped)) {
      throw new Fc25ParseError(
        `Invalid Alternative positions value "${trimmed}" on CSV line ${sourceLine}`
      );
    }
    return mapped as Fc25Position;
  });
}

function parseMetricPrefix(value: string, field: string, sourceLine: number): number {
  const match = /^(\d+)/.exec(value.trim());
  if (!match) {
    throw new Fc25ParseError(`Invalid ${field} "${value}" on CSV line ${sourceLine}`);
  }
  return Number(match[1]);
}

function parsePlayerId(url: string, sourceLine: number): string {
  const match = /\/(\d+)$/.exec(url.trim());
  if (!match) {
    throw new Fc25ParseError(`Could not parse player id from url on CSV line ${sourceLine}`);
  }
  return match[1]!;
}
