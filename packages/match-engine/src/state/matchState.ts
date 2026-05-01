import type {
  Coordinate2D,
  Coordinate3D,
  MatchDuration,
  PlayerInput,
  PlayerInputV2,
  PressureLevel,
  PossessionChangeCause,
  SemanticEvent,
  Team,
  TeamV2,
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
  lateralAnchor: number;
  hasBall: boolean;
  onPitch: boolean;
  yellowCards: number;
  redCard: boolean;
  lastWideCarryTick: number | null;
  baseInput: PlayerInput;
  v2Input?: PlayerInputV2;
}

export interface MutableBall {
  position: Coordinate3D;
  targetPosition: Coordinate3D | null;
  inFlight: boolean;
  carrierPlayerId: string | null;
  targetCarrierPlayerId: string | null;
}

export interface PendingSetPiece {
  type: "throw_in" | "goal_kick" | "free_kick";
  teamId: TeamId;
  takerPlayerId: string;
  position: Coordinate2D;
  ticksUntilRestart: number;
  detail?: Record<string, unknown>;
}

export interface PendingGoal {
  scoringTeam: TeamId;
  restartTeam: TeamId;
  scorerPlayerId: string;
  score: { home: number; away: number };
  ticksUntilKickoff: number;
}

export interface MutableMatchState {
  iteration: number;
  matchClock: { half: 1 | 2; minute: number; seconds: number };
  duration: MatchDuration;
  seed: number;
  rng: Rng;
  homeTeam: Team | TeamV2;
  awayTeam: Team | TeamV2;
  players: MutablePlayer[];
  ball: MutableBall;
  score: { home: number; away: number };
  stats: { home: TeamStatistics; away: TeamStatistics };
  possession: { teamId: TeamId | null; zone: Zone; pressureLevel: PressureLevel };
  possessionTicks: { home: number; away: number };
  possessionStreak: { teamId: TeamId | null; ticks: number };
  attackMomentum: { home: number; away: number };
  pendingGoal: PendingGoal | null;
  pendingSetPiece: PendingSetPiece | null;
  pendingLooseBallCause: PossessionChangeCause | null;
  pendingLooseBallPreviousPossessor: string | null;
  eventsThisTick: SemanticEvent[];
  allEvents: SemanticEvent[];
  openingKickoffPending: boolean;
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
