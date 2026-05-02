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

const SOURCE_POSITIONS = new Set<string>(FC25_SOURCE_POSITIONS);
const ENGINE_POSITIONS = new Set<string>(FC25_POSITIONS);

export class Fc25ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Fc25ParseError";
  }
}

export function parseFc25PlayersCsv(content: string): Fc25ParsedPlayerRow[] {
  const records = parse<Fc25CsvRecord>(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true
  });

  return records.map((record, index) => parseFc25PlayerRecord(record, index + 2));
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
    overall: parseRating(required(record, "OVR", sourceLine), "OVR", sourceLine),
    position,
    sourcePosition,
    alternativePositions: parseAlternativePositions(record["Alternative positions"] ?? "", sourceLine),
    age: parseInteger(required(record, "Age", sourceLine), "Age", sourceLine),
    nationality: required(record, "Nation", sourceLine),
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
    attributes: parseAttributes(record, sourceLine),
    gkAttributes: position === "GK" ? parseGoalkeeperAttributes(record, sourceLine) : null
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

function parseRating(value: string, field: string, sourceLine: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Fc25ParseError(`Invalid ${field} "${value}" on CSV line ${sourceLine}`);
  }
  return Math.round(parsed);
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
