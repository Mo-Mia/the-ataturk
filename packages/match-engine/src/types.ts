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
export type AttackDirection = 1 | -1;
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
export type SetPieceType = "corner" | "direct_free_kick" | "indirect_free_kick" | "penalty";
export type CornerDeliveryType = "in_swinger" | "out_swinger" | "low";
export type FreeKickType = "direct" | "crossed" | "passed";
export type SaveQuality = "routine" | "good" | "spectacular";
export type SaveResult = "caught" | "parried_safe" | "parried_dangerous";
export type FoulSeverity = "minor" | "cynical" | "reckless";
export type TackleType = "standing" | "sliding";
export type PassType = "short" | "long" | "through_ball" | "cross" | "cutback" | "switch" | "back";
export type SubstitutionReason = "manual" | "auto-fatigue" | "auto-tactical" | "auto-injury-future";

/** Calibrated v1 player attributes consumed directly by the match engine. */
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

/** FC25-style outfield attribute payload accepted by the v2 adapter. */
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

/** FC25-style goalkeeper attribute payload required for v2 goalkeepers. */
export interface GoalkeeperAttributesV2 {
  gkDiving: number;
  gkHandling: number;
  gkKicking: number;
  gkPositioning: number;
  gkReflexes: number;
}

/** A match team using the calibrated v1 player shape. */
export interface Team {
  id: string;
  name: string;
  shortName: string;
  players: PlayerInput[];
  bench?: PlayerInput[];
  tactics: TeamTactics;
  primaryColor?: string;
  secondaryColor?: string;
}

/** Public v1 player input accepted by the match engine. */
export interface PlayerInput {
  id: string;
  name: string;
  shortName: string;
  displayName?: string;
  sourceName?: string;
  squadNumber?: number;
  position: Position;
  attributes: PlayerAttributes;
  overrides?: PlayerOverrides;
}

/** A match team using FC25-style v2 player inputs. */
export interface TeamV2 extends Omit<Team, "players" | "bench"> {
  players: PlayerInputV2[];
  bench?: PlayerInputV2[];
}

/** Public FC25-style v2 player input accepted through the adapter bridge. */
export interface PlayerInputV2 {
  id: string;
  name: string;
  shortName: string;
  displayName?: string;
  sourceName?: string;
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

/** Tactical levers applied at kickoff for each simulated team. */
export interface TeamTactics {
  formation: string;
  mentality: "defensive" | "balanced" | "attacking";
  tempo: "slow" | "normal" | "fast";
  pressing: "low" | "medium" | "high";
  lineHeight: "deep" | "normal" | "high";
  width: "narrow" | "normal" | "wide";
}

/** Optional user-player intent toggles applied to an individual player. */
export interface PlayerOverrides {
  killerPass?: boolean;
  takeItOnYourself?: boolean;
  getForward?: boolean;
  sitDeeper?: boolean;
  pressTheBall?: boolean;
  aggressiveTackle?: boolean;
}

/** Public v1 match configuration for a deterministic simulation. */
export interface MatchConfig {
  homeTeam: Team;
  awayTeam: Team;
  duration: MatchDuration;
  seed: number;
  dynamics?: MatchDynamicsConfig;
  scheduledSubstitutions?: ScheduledSubstitution[];
  preMatchScore?: { home: number; away: number };
  preMatchStats?: {
    home?: TeamStatistics;
    away?: TeamStatistics;
  };
}

/** Public v2 match configuration using FC25-style player inputs. */
export interface MatchConfigV2 extends Omit<MatchConfig, "homeTeam" | "awayTeam"> {
  homeTeam: TeamV2;
  awayTeam: TeamV2;
}

/** Feature flags for calibrated optional match dynamics. */
export interface MatchDynamicsConfig {
  fatigue?: boolean;
  scoreState?: boolean;
  autoSubs?: boolean;
  chanceCreation?: boolean;
  setPieces?: boolean;
  sideSwitch?: boolean;
}

/** Scheduled substitution request applied at or after the requested match clock. */
export interface ScheduledSubstitution {
  teamId: TeamId;
  playerOutId: string;
  playerInId: string;
  minute: number;
  second?: number;
}

/** Full replay artefact produced by `simulateMatch`. */
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
    sideSwitchVersion?: 0 | 1;
    targets: CalibrationTargets;
    diagnostics?: {
      warnings: string[];
    };
  };
  ticks: MatchTick[];
  finalSummary: {
    finalScore: { home: number; away: number };
    statistics: { home: TeamStatistics; away: TeamStatistics };
    endStamina?: { home: PlayerStaminaSummary[]; away: PlayerStaminaSummary[] };
    substitutions?: { home: SubstitutionSummary[]; away: SubstitutionSummary[] };
    scoreStateEvents?: ScoreStateEventSummary[];
    setPieceTakers?: { home: SetPieceTakers; away: SetPieceTakers };
    setPieces?: { home: SetPieceSummary; away: SetPieceSummary };
  };
}

/** End-of-match stamina entry for one player. */
export interface PlayerStaminaSummary {
  playerId: string;
  stamina: number;
}

/** Summary of one manual or automatic substitution. */
export interface SubstitutionSummary {
  minute: number;
  second: number;
  playerOutId: string;
  playerInId: string;
  reason: SubstitutionReason;
  mode: "manual" | "auto";
}

/** Diagnostic record of score-state urgency at a score change. */
export interface ScoreStateEventSummary {
  tick: number;
  score: { home: number; away: number };
  urgency: { home: number; away: number };
}

/** Selected set-piece takers for a team. */
export interface SetPieceTakers {
  freeKick: string | null;
  corner: string | null;
  penalty: string | null;
}

/** Aggregate set-piece output for a team. */
export interface SetPieceSummary {
  corners: number;
  directFreeKicks: number;
  indirectFreeKicks: number;
  penalties: number;
  setPieceShots: number;
  setPieceGoals: number;
}

/** Roster metadata preserved in replay snapshots. */
export interface SnapshotRosterPlayer {
  id: string;
  name: string;
  shortName: string;
  displayName?: string;
  sourceName?: string;
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

/** One deterministic simulation tick in a replay or stream. */
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
    stamina?: number;
  }>;
  score: { home: number; away: number };
  possession: { teamId: TeamId | null; zone: Zone };
  attackMomentum?: { home: number; away: number };
  possessionStreak?: { teamId: TeamId | null; ticks: number };
  attackDirection?: { home: AttackDirection; away: AttackDirection };
  diagnostics?: MatchTickDiagnostics;
  events: SemanticEvent[];
}

/** Optional per-tick diagnostic payload for workbench visualisation. */
export interface MatchTickDiagnostics {
  shape: {
    home: TeamShapeDiagnostics;
    away: TeamShapeDiagnostics;
  };
}

/** Team-shape diagnostic values used by replay and compare views. */
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

/** Semantic event emitted for replay timelines, statistics, and UAT inspection. */
export interface SemanticEvent {
  type:
    | "goal"
    | "goal_scored"
    | "shot"
    | "chance_created"
    | "carry"
    | "pass"
    | "save"
    | "foul"
    | "yellow"
    | "red"
    | "corner"
    | "corner_taken"
    | "goal_kick"
    | "throw_in"
    | "free_kick"
    | "free_kick_taken"
    | "penalty_taken"
    | "possession_change"
    | "kick_off"
    | "substitution"
    | "half_time"
    | "full_time";
  team: TeamId;
  playerId?: string;
  minute: number;
  second: number;
  detail?: Record<string, unknown>;
}

/** Aggregate team statistics captured at each replay tick and final summary. */
export interface TeamStatistics {
  goals: number;
  shots: { total: number; on: number; off: number; blocked: number };
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  possession: number;
}

/** Characterisation target bands used by calibration checks. */
export interface CalibrationTargets {
  shotsTarget: [number, number];
  goalsTarget: [number, number];
  foulsTarget: [number, number];
  cardsTarget: [number, number];
  maxSingleScoreShare: number;
}
