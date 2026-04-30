import type {
  Coordinate2D,
  Coordinate3D,
  MatchDuration,
  PlayerInput,
  PressureLevel,
  SemanticEvent,
  Team,
  TeamId,
  TeamStatistics,
  Zone
} from "../types";
import type { Rng } from "../utils/rng";

export interface MutablePlayer {
  id: string;
  teamId: TeamId;
  position: Coordinate2D;
  targetPosition: Coordinate2D;
  anchorPosition: Coordinate2D;
  hasBall: boolean;
  onPitch: boolean;
  yellowCards: number;
  redCard: boolean;
  baseInput: PlayerInput;
}

export interface MutableBall {
  position: Coordinate3D;
  targetPosition: Coordinate3D | null;
  inFlight: boolean;
  carrierPlayerId: string | null;
  targetCarrierPlayerId: string | null;
}

export interface MutableMatchState {
  iteration: number;
  matchClock: { half: 1 | 2; minute: number; seconds: number };
  duration: MatchDuration;
  seed: number;
  rng: Rng;
  homeTeam: Team;
  awayTeam: Team;
  players: MutablePlayer[];
  ball: MutableBall;
  score: { home: number; away: number };
  stats: { home: TeamStatistics; away: TeamStatistics };
  possession: { teamId: TeamId | null; zone: Zone; pressureLevel: PressureLevel };
  possessionTicks: { home: number; away: number };
  eventsThisTick: SemanticEvent[];
  allEvents: SemanticEvent[];
}

export function emptyTeamStatistics(): TeamStatistics {
  return {
    goals: 0,
    shots: { total: 0, on: 0, off: 0, blocked: 0 },
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    corners: 0,
    possession: 50
  };
}

export function otherTeam(teamId: TeamId): TeamId {
  return teamId === "home" ? "away" : "home";
}
