export const POSITIONS = ["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"] as const;
export type Position = (typeof POSITIONS)[number];

export const INJURY_STATUSES = ["fit", "doubt", "injured", "long-term"] as const;
export type InjuryStatus = (typeof INJURY_STATUSES)[number];

export const PLAYER_ORIGINS = ["real", "user_created"] as const;
export type PlayerOrigin = (typeof PLAYER_ORIGINS)[number];

export const PRESET_ARCHETYPES = [
  "target-man",
  "speedy-winger",
  "trequartista",
  "box-to-box",
  "deep-lying-playmaker",
  "ball-playing-defender",
  "marauding-full-back",
  "sweeper-keeper",
  "blank-slate"
] as const;
export type PresetArchetype = (typeof PRESET_ARCHETYPES)[number];

export const PLAYER_ATTRIBUTE_NAMES = [
  "passing",
  "shooting",
  "tackling",
  "saving",
  "agility",
  "strength",
  "penalty_taking",
  "perception",
  "jumping",
  "control"
] as const;
export type PlayerAttributeName = (typeof PLAYER_ATTRIBUTE_NAMES)[number];

export type FixtureRound = "group" | "r16" | "qf" | "sf" | "final";

export interface Club {
  id: string;
  name: string;
  short_name: string;
  country: string;
  league: string;
  manager_real: string;
  stadium_name: string;
  stadium_capacity: number | null;
  kit_primary_hex: string | null;
  kit_secondary_hex: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerBase {
  id: string;
  club_id: string;
  name: string;
  short_name: string;
  squad_number: number | null;
  position_primary: Position;
  position_secondary: Position | null;
  date_of_birth: string | null;
  nationality: string;
  height_cm: number | null;
  is_captain: boolean;
  is_eligible_european: boolean;
  injury_status: InjuryStatus;
  fitness: number;
  form: number;
  real_player_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface RealPlayer extends PlayerBase {
  player_origin: "real";
  user_id: null;
  preset_archetype: null;
  budget_used: null;
}

export interface UserCreatedPlayer extends PlayerBase {
  player_origin: "user_created";
  user_id: string;
  preset_archetype: PresetArchetype;
  budget_used: number;
}

export type Player = RealPlayer | UserCreatedPlayer;

export interface InsertUserPlayerInput {
  id: string;
  club_id: string;
  name: string;
  short_name: string;
  squad_number: number | null;
  position_primary: Position;
  position_secondary: Position | null;
  date_of_birth: string | null;
  nationality: string;
  height_cm: number | null;
  user_id: string;
  preset_archetype: PresetArchetype;
  budget_used: number;
  is_captain?: boolean;
  is_eligible_european?: boolean;
  injury_status?: InjuryStatus;
  fitness?: number;
  form?: number;
  real_player_reference?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DatasetVersion {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerAttributes {
  id: string;
  player_id: string;
  dataset_version: string;
  passing: number;
  shooting: number;
  tackling: number;
  saving: number;
  agility: number;
  strength: number;
  penalty_taking: number;
  perception: number;
  jumping: number;
  control: number;
  rationale: string | null;
  generated_by: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlayerAttributeHistory {
  id: number;
  player_id: string;
  dataset_version: string;
  attribute_name: PlayerAttributeName;
  old_value: number;
  new_value: number;
  changed_at: string;
  changed_by: string;
}

export interface Fixture {
  id: string;
  home_club_id: string;
  away_club_id: string;
  round: FixtureRound;
  leg: number;
  kicked_off_at: string;
  venue_name: string;
  venue_city: string;
  real_result_home_goals: number | null;
  real_result_away_goals: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SquadPlayerWithAttributes {
  player: Player;
  attributes: PlayerAttributes | null;
}
