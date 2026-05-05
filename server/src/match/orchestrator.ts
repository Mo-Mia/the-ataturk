import { playIteration, type MatchDetails, type TeamStatistics } from "@the-ataturk/engine";
import { withEngineConsoleMuted } from "@the-ataturk/engine/internal/silence";

import { ITERATIONS_PER_HALF, REAL_TIME_ITERATION_DELAY_MS } from "../config";
import { extractEvents, type SemanticEvent } from "./events";

export interface MatchClock {
  half: 2;
  minute: number;
  seconds: number;
}

export interface MatchTick {
  iteration: number;
  matchClock: MatchClock;
  score: MatchScore;
  events: SemanticEvent[];
  matchDetails: MatchDetails;
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

export interface FinalMatchSummary {
  iterations: number;
  finalClock: MatchClock;
  finalScore: {
    home: number;
    away: number;
  };
  statistics: {
    home: TeamStatistics;
    away: TeamStatistics;
  };
  matchDetails: MatchDetails;
}

export interface IterateMatchOptions {
  iterations?: number;
  iterationDelayMs?: number;
  signal?: AbortSignal;
}

const SECONDS_PER_ITERATION = 6;

/**
 * Iterate the legacy engine from a half-time state and yield UI-ready match ticks.
 *
 * @param initialMatchDetails Engine state at the start of the streamed segment.
 * @param options Optional iteration count, delay, and abort signal.
 * @returns Async iterable of match ticks including clock, score, semantic events, and raw state.
 * @throws DOMException with `AbortError` when the supplied signal is aborted.
 */
export async function* iterateMatch(
  initialMatchDetails: MatchDetails,
  options: IterateMatchOptions = {}
): AsyncIterable<MatchTick> {
  const iterations = options.iterations ?? ITERATIONS_PER_HALF;
  const iterationDelayMs = options.iterationDelayMs ?? REAL_TIME_ITERATION_DELAY_MS;
  let matchDetails = structuredClone(initialMatchDetails);

  yield toMatchTick(0, matchDetails, []);

  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    throwIfAborted(options.signal);
    await sleep(iterationDelayMs, options.signal);
    throwIfAborted(options.signal);

    const previousMatchDetails = structuredClone(matchDetails);
    matchDetails = await withEngineConsoleMuted(() => playIteration(matchDetails));
    const clock = clockForIteration(iteration);
    const events = extractEvents(previousMatchDetails, matchDetails, clock);

    yield toMatchTick(iteration, matchDetails, events);
  }
}

/**
 * Convert a second-half iteration index into the replay clock.
 *
 * @param iteration Iteration index from the streamed second-half segment.
 * @returns Match clock in half/minute/second form.
 */
export function clockForIteration(iteration: number): MatchClock {
  const elapsedSeconds = iteration * SECONDS_PER_ITERATION;
  const totalSeconds = 45 * 60 + elapsedSeconds;

  return {
    half: 2,
    minute: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60
  };
}

/**
 * Convert the latest streamed tick into the final SSE summary payload.
 *
 * @param matchTick Last emitted match tick.
 * @returns Final score, statistics, clock, and raw engine state.
 */
export function toFinalMatchSummary(matchTick: MatchTick): FinalMatchSummary {
  return {
    iterations: matchTick.iteration,
    finalClock: matchTick.matchClock,
    finalScore: {
      home: matchTick.score.home.goals,
      away: matchTick.score.away.goals
    },
    statistics: {
      home: matchTick.matchDetails.kickOffTeamStatistics,
      away: matchTick.matchDetails.secondTeamStatistics
    },
    matchDetails: matchTick.matchDetails
  };
}

function toMatchTick(
  iteration: number,
  matchDetails: MatchDetails,
  events: SemanticEvent[]
): MatchTick {
  return {
    iteration,
    matchClock: clockForIteration(iteration),
    score: {
      home: {
        club_id: String(matchDetails.kickOffTeam.teamID),
        name: String(matchDetails.kickOffTeam.name),
        goals: numericGoal(matchDetails.kickOffTeamStatistics.goals)
      },
      away: {
        club_id: String(matchDetails.secondTeam.teamID),
        name: String(matchDetails.secondTeam.name),
        goals: numericGoal(matchDetails.secondTeamStatistics.goals)
      }
    },
    events,
    matchDetails
  };
}

function numericGoal(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Match iteration aborted", "AbortError");
  }
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Match iteration aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
