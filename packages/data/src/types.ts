import type {
  MatchDuration,
  PlayerInputV2,
  Position as EnginePosition,
  ScoreStateEventSummary,
  SetPieceSummary,
  SetPieceTakers,
  SubstitutionSummary
} from "@the-ataturk/match-engine";

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
export type PlayerAttributeChanges = Partial<Record<PlayerAttributeName, number>>;
export type PlayerAttributeValues = Record<PlayerAttributeName, number>;

export const PLAYER_PROFILE_TIERS = ["S", "A", "B", "C", "D"] as const;
export type PlayerProfileTier = (typeof PLAYER_PROFILE_TIERS)[number];

export const PLAYER_PROFILE_FIELD_NAMES = [
  "tier",
  "role_2004_05",
  "qualitative_descriptor"
] as const;
export type PlayerProfileFieldName = (typeof PLAYER_PROFILE_FIELD_NAMES)[number];

export interface PlayerProfileChanges {
  tier?: PlayerProfileTier;
  role_2004_05?: string | null;
  qualitative_descriptor?: string | null;
}

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

export interface PlayerProfileVersion {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  parent_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerProfileVersionSummary extends PlayerProfileVersion {
  profile_count: number;
  uncurated_count: number;
  failed_count: number;
}

export interface CreateDatasetVersionInput {
  id: string;
  name: string;
  description?: string | null;
  parent_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePlayerProfileVersionInput {
  id: string;
  name: string;
  description?: string | null;
  parent_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
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

export interface UpdatePlayerAttributesInput {
  playerId: string;
  datasetVersion: string;
  changes: PlayerAttributeChanges;
  changedBy?: string;
  changedAt?: string;
  generatedBy?: string;
  generatedAt?: string;
}

export interface PlayerProfile {
  id: string;
  player_id: string;
  profile_version: string;
  tier: PlayerProfileTier;
  role_2004_05: string | null;
  qualitative_descriptor: string | null;
  generated_by: string;
  generated_at: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlayerProfileHistory {
  id: number;
  player_id: string;
  profile_version: string;
  field_name: PlayerProfileFieldName;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string;
}

export interface UpdatePlayerProfileInput {
  playerId: string;
  profileVersion: string;
  changes: PlayerProfileChanges;
  changedBy?: string;
  changedAt?: string;
  markEdited?: boolean;
  generatedBy?: string;
  generatedAt?: string;
}

export interface PlayerProfileExtractionCandidate {
  player: Player;
  profile: PlayerProfile;
}

export interface PlayerAttributeDerivationCandidate {
  player: Player;
  profile: PlayerProfile;
  attributes: PlayerAttributes;
}

export interface PlayerProfileDerivationBlocker {
  player_id: string;
  player_name: string;
  reason: string;
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

export const FC25_CLUB_IDS = [
  "arsenal",
  "manchester-city",
  "manchester-united",
  "liverpool",
  "aston-villa"
] as const;
export type Fc25ClubId = (typeof FC25_CLUB_IDS)[number];

export const FC25_POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "DM",
  "CM",
  "AM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST"
] as const;
export type Fc25Position = (typeof FC25_POSITIONS)[number];

export const FC25_SOURCE_POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST"
] as const;
export type Fc25SourcePosition = (typeof FC25_SOURCE_POSITIONS)[number];

export const FC25_SQUAD_ROLES = ["starter", "sub", "reserve"] as const;
export type Fc25SquadRole = (typeof FC25_SQUAD_ROLES)[number];

export type Fc25PreferredFoot = "left" | "right" | "either";
export type Fc25StarRating = 1 | 2 | 3 | 4 | 5;

export interface Fc25ClubDefinition {
  id: Fc25ClubId;
  name: string;
  shortName: string;
  country: string;
  league: string;
  sourceTeam: string;
}

export interface Fc25DatasetVersion {
  id: string;
  name: string;
  source_file: string;
  source_file_sha256: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Fc25Club {
  dataset_version_id: string;
  id: Fc25ClubId;
  name: string;
  short_name: string;
  country: string;
  league: string;
  fc25_team_id: string;
  created_at: string;
  updated_at: string;
}

export interface Fc25PlayerAttributes {
  acceleration: number;
  sprintSpeed: number;
  finishing: number;
  shotPower: number;
  longShots: number;
  positioning: number;
  volleys: number;
  penalties: number;
  vision: number;
  crossing: number;
  freeKickAccuracy: number;
  shortPassing: number;
  longPassing: number;
  curve: number;
  dribbling: number;
  agility: number;
  balance: number;
  reactions: number;
  ballControl: number;
  composure: number;
  interceptions: number;
  headingAccuracy: number;
  defensiveAwareness: number;
  standingTackle: number;
  slidingTackle: number;
  jumping: number;
  stamina: number;
  strength: number;
  aggression: number;
}

export interface Fc25GoalkeeperAttributes {
  gkDiving: number;
  gkHandling: number;
  gkKicking: number;
  gkPositioning: number;
  gkReflexes: number;
}

export interface Fc26PlayerMetadata {
  potential: number | null;
  valueEur: number | null;
  wageEur: number | null;
  releaseClauseEur: number | null;
  bodyType: string | null;
  workRate: string | null;
  internationalReputation: number | null;
  playerTraits: string | null;
  playerTags: string | null;
  categoryPace: number | null;
  categoryShooting: number | null;
  categoryPassing: number | null;
  categoryDribbling: number | null;
  categoryDefending: number | null;
  categoryPhysic: number | null;
  goalkeepingSpeed: number | null;
  positionRatings: Record<string, number>;
}

export interface Fc25ParsedPlayerRow {
  sourceIndex: number;
  rank: number;
  fc25PlayerId: string;
  name: string;
  overall: number;
  position: Fc25Position;
  sourcePosition: Fc25SourcePosition;
  alternativePositions: Fc25Position[];
  age: number;
  nationality: string;
  league: string;
  sourceTeam: string;
  preferredFoot: Fc25PreferredFoot;
  weakFootRating: Fc25StarRating;
  skillMovesRating: Fc25StarRating;
  heightCm: number;
  weightKg: number;
  playStyle: string | null;
  sourceUrl: string;
  squadNumber: number | null;
  sourceSquadRole: string | null;
  fc26Metadata: Fc26PlayerMetadata | null;
  attributes: Fc25PlayerAttributes;
  gkAttributes: Fc25GoalkeeperAttributes | null;
}

export interface Fc25SquadPlayer extends PlayerInputV2 {
  overall: number;
  sourcePosition: Fc25Position;
  alternativePositions: Fc25Position[];
}

export interface MatchRunLineupPlayer {
  id: string;
  name: string;
  shortName: string;
  position: EnginePosition;
  squadNumber?: number;
}

export type LineupSelectionMode = "auto" | "manual";
export type LineupRoleFit = "exact" | "alternative" | "adjacent" | "out_of_position";
export type LineupWarningCode = "adjacent_fit" | "out_of_position";

export interface MatchRunLineupWarning {
  code: LineupWarningCode;
  playerId: string;
  playerName: string;
  role: EnginePosition;
  sourcePosition: Fc25Position;
  message: string;
}

export interface MatchRunLineupSelection {
  mode: LineupSelectionMode;
  warnings: MatchRunLineupWarning[];
}

export interface MatchRunSummary {
  score: { home: number; away: number };
  shots: { home: number; away: number };
  fouls: { home: number; away: number };
  cards: { home: number; away: number };
  possession: { home: number; away: number };
  duration?: MatchDuration;
  xi?: {
    home: MatchRunLineupPlayer[];
    away: MatchRunLineupPlayer[];
  };
  bench?: {
    home: MatchRunLineupPlayer[];
    away: MatchRunLineupPlayer[];
  };
  xiSelection?: {
    home: MatchRunLineupSelection;
    away: MatchRunLineupSelection;
  };
  autoSubs?: boolean;
  substitutions?: {
    home: SubstitutionSummary[];
    away: SubstitutionSummary[];
  };
  endStamina?: {
    home: Array<{ playerId: string; stamina: number }>;
    away: Array<{ playerId: string; stamina: number }>;
  };
  scoreStateEvents?: ScoreStateEventSummary[];
  setPieceTakers?: { home: SetPieceTakers; away: SetPieceTakers };
  setPieces?: { home: SetPieceSummary; away: SetPieceSummary };
  sideSwitchVersion?: 0 | 1;
}

export interface MatchRun {
  id: string;
  created_at: string;
  batch_id: string | null;
  seed: number;
  home_club_id: Fc25ClubId;
  away_club_id: Fc25ClubId;
  home_tactics: unknown;
  away_tactics: unknown;
  summary: MatchRunSummary;
  artefact_filename: string;
}

export interface CreateMatchRunInput {
  id: string;
  created_at: string;
  batch_id?: string | null;
  seed: number;
  home_club_id: Fc25ClubId;
  away_club_id: Fc25ClubId;
  home_tactics: unknown;
  away_tactics: unknown;
  summary: MatchRunSummary;
  artefact_filename: string;
}

export interface MatchRunPage {
  runs: MatchRun[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
