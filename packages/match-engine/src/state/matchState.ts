import type { PlayerInput, SemanticEvent, TeamStatistics, Team } from "../types";

export interface MutablePlayer {
  id: string;
  teamId: "home" | "away";
  position: [number, number];
  targetPosition: [number, number];
  hasBall: boolean;
  onPitch: boolean;
  baseInput: PlayerInput;
}

export interface MutableMatchState {
  iteration: number;
  matchClock: { half: 1 | 2; minute: number; seconds: number };
  
  homeTeam: Team;
  awayTeam: Team;
  duration: "full_90" | "second_half";
  seed: number;

  ball: {
    position: [number, number, number];
    inFlight: boolean;
    carrierPlayerId: string | null;
  };

  players: MutablePlayer[];

  score: { home: number; away: number };
  
  possession: {
    teamId: "home" | "away" | null;
    zone: "def" | "mid" | "att";
  };

  eventsThisTick: SemanticEvent[];
  allEvents: SemanticEvent[];

  stats: {
    home: TeamStatistics;
    away: TeamStatistics;
  };
}
