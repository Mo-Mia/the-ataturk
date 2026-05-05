import type {
  MatchDuration,
  Position,
  ScoreStateEventSummary,
  SetPieceSummary,
  SetPieceTakers,
  SubstitutionSummary,
  TeamTactics
} from "@the-ataturk/match-engine";

export interface RunLineupPlayer {
  id: string;
  name: string;
  shortName: string;
  displayName?: string;
  sourceName?: string;
  position: Position;
  squadNumber?: number;
}

export interface LineupWarning {
  code: "adjacent_fit" | "out_of_position";
  playerId: string;
  playerName: string;
  role: Position;
  sourcePosition: Position;
  message: string;
}

export interface LineupSelectionSummary {
  mode: "auto" | "manual";
  warnings: LineupWarning[];
}

export interface SimRunSummary {
  score: { home: number; away: number };
  shots: { home: number; away: number };
  fouls: { home: number; away: number };
  cards: { home: number; away: number };
  possession: { home: number; away: number };
  duration?: MatchDuration;
  xi?: {
    home: RunLineupPlayer[];
    away: RunLineupPlayer[];
  };
  bench?: {
    home: RunLineupPlayer[];
    away: RunLineupPlayer[];
  };
  xiSelection?: {
    home: LineupSelectionSummary;
    away: LineupSelectionSummary;
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

export function playerDisplayName(player: {
  displayName?: string;
  shortName?: string;
  name?: string;
  id: string;
}): string {
  return player.displayName ?? player.shortName ?? player.name ?? player.id;
}
