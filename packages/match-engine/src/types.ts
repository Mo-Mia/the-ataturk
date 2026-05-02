export type TeamId = "home" | "away";
export type Position =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "DM"
  | "CM"
  | "AM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "ST";
export type Zone = "def" | "mid" | "att";
export type PressureLevel = "low" | "medium" | "high";
export type MatchDuration = "full_90" | "second_half";
export type Coordinate2D = [x: number, y: number];
export type Coordinate3D = [x: number, y: number, z: number];
export type PreferredFoot = "left" | "right" | "either";
export type StarRating = 1 | 2 | 3 | 4 | 5;
export type PossessionChangeCause =
  | "successful_tackle"
  | "failed_dribble"
  | "intercepted_pass"
  | "loose_ball_recovered"
  | "clearance_recovered"
  | "goalkeeper_save"
  | "shot_blocked"
  | "foul_against_carrier"
  | "restart_throw_in"
  | "restart_goal_kick"
  | "restart_corner"
  | "kickoff_after_goal"
  | "kickoff_match_start"
  | "kickoff_second_half";
export type ShotType = "header" | "volley" | "placed" | "power" | "first_time" | "long_range";
export type ShotFoot = "preferred" | "weak";
export type SaveQuality = "routine" | "good" | "spectacular";
export type SaveResult = "caught" | "parried_safe" | "parried_dangerous";
export type FoulSeverity = "minor" | "cynical" | "reckless";
export type TackleType = "standing" | "sliding";
export type PassType = "short" | "long" | "through_ball" | "cross" | "cutback" | "switch" | "back";

export interface PlayerAttributes {
  passing: number;
  shooting: number;
  tackling: number;
  saving: number;
  agility: number;
  strength: number;
  penaltyTaking: number;
  perception: number;
  jumping: number;
  control: number;
}

export interface PlayerAttributesV2 {
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

export interface GoalkeeperAttributesV2 {
  gkDiving: number;
  gkHandling: number;
  gkKicking: number;
  gkPositioning: number;
  gkReflexes: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  players: PlayerInput[];
  tactics: TeamTactics;
  primaryColor?: string;
  secondaryColor?: string;
}

export interface PlayerInput {
  id: string;
  name: string;
  shortName: string;
  squadNumber?: number;
  position: Position;
  attributes: PlayerAttributes;
  overrides?: PlayerOverrides;
}

export interface TeamV2 extends Omit<Team, "players"> {
  players: PlayerInputV2[];
}

export interface PlayerInputV2 {
  id: string;
  name: string;
  shortName: string;
  squadNumber?: number;
  position: Position;
  height?: number;
  weight?: number;
  age?: number;
  preferredFoot: PreferredFoot;
  weakFootRating: StarRating;
  skillMovesRating: StarRating;
  attributes: PlayerAttributesV2;
  gkAttributes?: GoalkeeperAttributesV2;
  overrides?: PlayerOverrides;
}

export interface TeamTactics {
  formation: string;
  mentality: "defensive" | "balanced" | "attacking";
  tempo: "slow" | "normal" | "fast";
  pressing: "low" | "medium" | "high";
  lineHeight: "deep" | "normal" | "high";
  width: "narrow" | "normal" | "wide";
}

export interface PlayerOverrides {
  killerPass?: boolean;
  takeItOnYourself?: boolean;
  getForward?: boolean;
  sitDeeper?: boolean;
  pressTheBall?: boolean;
  aggressiveTackle?: boolean;
}

export interface MatchConfig {
  homeTeam: Team;
  awayTeam: Team;
  duration: MatchDuration;
  seed: number;
  preMatchScore?: { home: number; away: number };
  preMatchStats?: {
    home?: TeamStatistics;
    away?: TeamStatistics;
  };
}

export interface MatchConfigV2 extends Omit<MatchConfig, "homeTeam" | "awayTeam"> {
  homeTeam: TeamV2;
  awayTeam: TeamV2;
}

export interface MatchSnapshot {
  meta: {
    homeTeam: { id: string; name: string; shortName: string };
    awayTeam: { id: string; name: string; shortName: string };
    rosters: {
      home: SnapshotRosterPlayer[];
      away: SnapshotRosterPlayer[];
    };
    seed: number;
    duration: MatchConfig["duration"];
    preMatchScore: { home: number; away: number };
    generatedAt: string;
    targets: CalibrationTargets;
  };
  ticks: MatchTick[];
  finalSummary: {
    finalScore: { home: number; away: number };
    statistics: { home: TeamStatistics; away: TeamStatistics };
  };
}

export interface SnapshotRosterPlayer {
  id: string;
  name: string;
  shortName: string;
  squadNumber?: number;
  position: Position;
  height?: number;
  weight?: number;
  age?: number;
  preferredFoot?: PreferredFoot;
  weakFootRating?: StarRating;
  skillMovesRating?: StarRating;
  attributesV2?: PlayerAttributesV2;
  gkAttributesV2?: GoalkeeperAttributesV2;
}

export interface MatchTick {
  iteration: number;
  matchClock: { half: 1 | 2; minute: number; seconds: number };
  ball: {
    position: Coordinate3D;
    inFlight: boolean;
    carrierPlayerId: string | null;
  };
  players: Array<{
    id: string;
    teamId: TeamId;
    position: Coordinate2D;
    hasBall: boolean;
    onPitch: boolean;
  }>;
  score: { home: number; away: number };
  possession: { teamId: TeamId | null; zone: Zone };
  attackMomentum?: { home: number; away: number };
  possessionStreak?: { teamId: TeamId | null; ticks: number };
  diagnostics?: MatchTickDiagnostics;
  events: SemanticEvent[];
}

export interface MatchTickDiagnostics {
  shape: {
    home: TeamShapeDiagnostics;
    away: TeamShapeDiagnostics;
  };
}

export interface TeamShapeDiagnostics {
  activePlayers: number;
  lineHeight: {
    team: number;
    defence: number | null;
    midfield: number | null;
    attack: number | null;
  };
  spread: {
    width: number;
    depth: number;
    compactness: number;
  };
  thirds: {
    defensive: number;
    middle: number;
    attacking: number;
  };
  oppositionHalfPlayers: number;
  ballSidePlayers: number;
}

export interface SemanticEvent {
  type:
    | "goal"
    | "goal_scored"
    | "shot"
    | "carry"
    | "pass"
    | "save"
    | "foul"
    | "yellow"
    | "red"
    | "corner"
    | "goal_kick"
    | "throw_in"
    | "free_kick"
    | "possession_change"
    | "kick_off"
    | "half_time"
    | "full_time";
  team: TeamId;
  playerId?: string;
  minute: number;
  second: number;
  detail?: Record<string, unknown>;
}

export interface TeamStatistics {
  goals: number;
  shots: { total: number; on: number; off: number; blocked: number };
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  possession: number;
}

export interface CalibrationTargets {
  shotsTarget: [number, number];
  goalsTarget: [number, number];
  foulsTarget: [number, number];
  cardsTarget: [number, number];
  maxSingleScoreShare: number;
}
