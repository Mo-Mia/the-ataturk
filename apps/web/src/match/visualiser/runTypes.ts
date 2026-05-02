import type { TeamTactics } from "@the-ataturk/match-engine";

export interface SimRunSummary {
  score: { home: number; away: number };
  shots: { home: number; away: number };
  fouls: { home: number; away: number };
  cards: { home: number; away: number };
  possession: { home: number; away: number };
}

export interface PersistedMatchRun {
  id: string;
  seed: number;
  batchId: string | null;
  createdAt: string;
  homeClubId: string;
  awayClubId: string;
  homeTactics: TeamTactics;
  awayTactics: TeamTactics;
  artefactId: string;
  summary: SimRunSummary;
}

export interface MatchRunListResponse {
  runs: PersistedMatchRun[];
  total: number;
  page: number;
  hasMore: boolean;
}

export interface SimError {
  seed: number;
  error: string;
}

export interface SimResponse {
  runs: PersistedMatchRun[];
  errors: SimError[];
}
