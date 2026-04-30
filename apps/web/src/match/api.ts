export type SemanticEventType = "goal" | "shot" | "save" | "foul" | "yellow" | "red";
export type SemanticEventTeam = "home" | "away";

export interface SemanticEvent {
  type: SemanticEventType;
  team: SemanticEventTeam;
  playerId?: string;
  minute: number;
  second: number;
  detail?: string;
}

export interface MatchClock {
  half: 2;
  minute: number;
  seconds: number;
}

export interface MatchScore {
  home: {
    club_id: string;
    name: string;
    goals: number;
  };
  away: {
    club_id: string;
    name: string;
    goals: number;
  };
}

export interface MatchPlayer {
  playerID: string | number;
  name: string;
}

export interface MatchTeam {
  teamID: string | number;
  name: string;
  players: MatchPlayer[];
}

export interface MatchDetails {
  kickOffTeam: MatchTeam;
  secondTeam: MatchTeam;
  kickOffTeamStatistics: unknown;
  secondTeamStatistics: unknown;
}

export interface MatchTick {
  iteration: number;
  matchClock: MatchClock;
  score: MatchScore;
  events: SemanticEvent[];
  matchDetails: MatchDetails;
}

export interface FinalMatchSummary {
  iterations: number;
  finalClock: MatchClock;
  finalScore: {
    home: number;
    away: number;
  };
}

export type MatchStreamEvent =
  | { event: "tick"; data: MatchTick }
  | { event: "final"; data: FinalMatchSummary }
  | { event: "error"; data: { error: string } };

export interface RunMatchOptions {
  fastForward: boolean;
  signal?: AbortSignal;
}

export async function runMatchStream(
  options: RunMatchOptions,
  onEvent: (event: MatchStreamEvent) => void
): Promise<FinalMatchSummary> {
  const query = options.fastForward ? "?speed=fast" : "";
  const requestInit: RequestInit =
    options.signal === undefined ? { method: "POST" } : { method: "POST", signal: options.signal };
  const response = await fetch(`/api/match/run${query}`, requestInit);

  if (!response.ok) {
    throw new Error(`Match request failed with ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Match response did not include a stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalSummary: FinalMatchSummary | null = null;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (!event) {
        continue;
      }

      onEvent(event);

      if (event.event === "final") {
        finalSummary = event.data;
      }

      if (event.event === "error") {
        throw new Error(event.data.error);
      }
    }
  }

  if (buffer.trim().length > 0) {
    const event = parseSseFrame(buffer);
    if (event) {
      onEvent(event);
      if (event.event === "final") {
        finalSummary = event.data;
      }
    }
  }

  if (!finalSummary) {
    throw new Error("Match stream finished without a final summary");
  }

  return finalSummary;
}

function parseSseFrame(frame: string): MatchStreamEvent | null {
  const eventLine = frame
    .split("\n")
    .find((line) => line.startsWith("event: "))
    ?.slice("event: ".length);
  const dataLine = frame
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);

  if (!eventLine || !dataLine) {
    return null;
  }

  const parsedData = JSON.parse(dataLine) as unknown;

  if (eventLine === "tick") {
    return { event: "tick", data: parsedData as MatchTick };
  }

  if (eventLine === "final") {
    return { event: "final", data: parsedData as FinalMatchSummary };
  }

  if (eventLine === "error") {
    return { event: "error", data: parsedData as { error: string } };
  }

  return null;
}
