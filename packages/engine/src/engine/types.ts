export type Coordinate2D = [number, number];
export type Coordinate3D = [number, number, number];
export type SkillRating = number | string;
export type TeamIntent = "attack" | "defend";
export type EngineAction = string | null;

export interface PlayerSkill {
  passing: SkillRating;
  shooting: SkillRating;
  tackling: SkillRating;
  saving: SkillRating;
  agility: SkillRating;
  strength: SkillRating;
  penalty_taking: SkillRating;
  perception: SkillRating;
  jumping: SkillRating;
  control: SkillRating;
  [key: string]: SkillRating;
}

export interface PlayerStats {
  goals: number;
  shots: {
    total: number;
    on: number;
    off: number;
  };
  cards: {
    yellow: number;
    red: number;
  };
  passes: {
    total: number;
    on: number;
    off: number;
  };
  tackles: {
    total: number;
    on: number;
    off: number;
    fouls: number;
  };
  [key: string]: unknown;
}

export interface PlayerInput {
  name: string;
  position: string;
  rating: SkillRating;
  skill: PlayerSkill;
  currentPOS: Coordinate2D;
  fitness: number;
  height: number;
  injured: boolean;
  [key: string]: unknown;
}

export interface Player extends PlayerInput {
  playerID: string | number;
  originPOS: Coordinate2D;
  intentPOS: Coordinate2D;
  action: EngineAction;
  offside: boolean;
  hasBall: boolean;
  stats: PlayerStats;
}

export interface TeamInput {
  name: string;
  players: PlayerInput[];
  rating?: SkillRating;
  manager?: string;
  [key: string]: unknown;
}

export interface Team extends Omit<TeamInput, "players"> {
  teamID: string | number;
  players: Player[];
  intent: TeamIntent;
}

export interface Pitch {
  pitchWidth: number;
  pitchHeight: number;
  goalWidth: number;
  [key: string]: unknown;
}

export interface BallLastTouch {
  playerName: string;
  playerID: string | number;
  teamID: string | number;
  bodyPart?: string;
  deflection?: boolean;
  iterations?: number | null;
  [key: string]: unknown;
}

export interface Ball {
  position: Coordinate3D;
  withPlayer: boolean;
  Player: string | number;
  withTeam: string | number;
  direction: string;
  lastTouch: BallLastTouch;
  ballOverIterations: unknown[];
  [key: string]: unknown;
}

export interface TeamStatistics {
  goals: number;
  shots: number;
  corners: number;
  freekicks: number;
  penalties: number;
  fouls: number;
  [key: string]: number;
}

export interface MatchDetails {
  matchID: string | number;
  kickOffTeam: Team;
  secondTeam: Team;
  pitchSize: Coordinate2D;
  ball: Ball;
  half: number;
  kickOffTeamStatistics: TeamStatistics;
  secondTeamStatistics: TeamStatistics;
  iterationLog: string[];
  endIteration?: boolean;
  [key: string]: unknown;
}

export interface FootballSimulationEngineModule {
  initiateGame(team1: TeamInput, team2: TeamInput, pitch: Pitch): Promise<MatchDetails>;
  playIteration(matchDetails: MatchDetails): Promise<MatchDetails>;
  startSecondHalf(matchDetails: MatchDetails): Promise<MatchDetails>;
}
