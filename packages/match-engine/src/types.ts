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
  position: "GK" | "CB" | "LB" | "RB" | "DM" | "CM" | "AM" | "LW" | "RW" | "ST";
  attributes: {
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
  };
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
  duration: "full_90" | "second_half";
  seed: number;
  preMatchScore?: { home: number; away: number };
  preMatchStats?: TeamStatistics & {
    home?: TeamStatistics;
    away?: TeamStatistics;
  };
}

export interface MatchSnapshot {
  meta: {
    homeTeam: { id: string; name: string; shortName: string };
    awayTeam: { id: string; name: string; shortName: string };
    seed: number;
    duration: MatchConfig["duration"];
    preMatchScore: { home: number; away: number };
    generatedAt: string;
    targets: {
      shotsTarget: [number, number];
      goalsTarget: [number, number];
      foulsTarget: [number, number];
      cardsTarget: [number, number];
    };
  };
  ticks: MatchTick[];
  finalSummary: {
    finalScore: { home: number; away: number };
    statistics: { home: TeamStatistics; away: TeamStatistics };
  };
}

export interface MatchTick {
  iteration: number;
  matchClock: { half: 1 | 2; minute: number; seconds: number };
  ball: {
    position: [x: number, y: number, z: number];
    inFlight: boolean;
    carrierPlayerId: string | null;
  };
  players: Array<{
    id: string;
    teamId: "home" | "away";
    position: [x: number, y: number];
    hasBall: boolean;
    onPitch: boolean;
  }>;
  score: { home: number; away: number };
  possession: { teamId: "home" | "away" | null; zone: "def" | "mid" | "att" };
  events: SemanticEvent[];
}

export interface SemanticEvent {
  type:
    | "goal"
    | "shot"
    | "save"
    | "foul"
    | "yellow"
    | "red"
    | "corner"
    | "throw_in"
    | "free_kick"
    | "possession_change"
    | "kick_off";
  team: "home" | "away";
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
