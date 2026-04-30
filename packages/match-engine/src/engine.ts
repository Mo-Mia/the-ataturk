import type { MatchConfig, MatchSnapshot, MatchTick } from "./types";
import { buildInitState } from "./state/initState";
import { runTick } from "./ticks/runTick";
import { TICKS_PER_HALF, TICKS_PER_FULL_MATCH } from "./calibration/constants";
import type { MutableMatchState } from "./state/matchState";

export function simulateMatch(config: MatchConfig): MatchSnapshot {
  const state = buildInitState(config);
  const ticks: MatchTick[] = [];
  
  const totalTicks = config.duration === "second_half" ? TICKS_PER_HALF : TICKS_PER_FULL_MATCH;

  for (let i = 0; i < totalTicks; i++) {
    runTick(state);
    ticks.push(toMatchTick(state));
  }

  return buildSnapshot(state, config, ticks);
}

export async function* simulateMatchStream(
  config: MatchConfig,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick> {
  const state = buildInitState(config);
  const totalTicks = config.duration === "second_half" ? TICKS_PER_HALF : TICKS_PER_FULL_MATCH;

  for (let i = 0; i < totalTicks; i++) {
    if (options?.signal?.aborted) {
      break;
    }

    runTick(state);
    yield toMatchTick(state);
    
    // minimal yield to event loop for stream
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function toMatchTick(state: MutableMatchState): MatchTick {
  return {
    iteration: state.iteration,
    matchClock: { ...state.matchClock },
    ball: { 
      inFlight: state.ball.inFlight,
      carrierPlayerId: state.ball.carrierPlayerId,
      position: [...state.ball.position]
    },
    players: state.players.map(p => ({
      id: p.id,
      teamId: p.teamId,
      position: [...p.position],
      hasBall: p.hasBall,
      onPitch: p.onPitch
    })),
    score: { ...state.score },
    possession: { ...state.possession },
    events: [...state.eventsThisTick]
  };
}

function buildSnapshot(state: MutableMatchState, config: MatchConfig, ticks: MatchTick[]): MatchSnapshot {
  return {
    meta: {
      homeTeam: { id: config.homeTeam.id, name: config.homeTeam.name, shortName: config.homeTeam.shortName },
      awayTeam: { id: config.awayTeam.id, name: config.awayTeam.name, shortName: config.awayTeam.shortName },
      seed: config.seed,
      duration: config.duration,
      preMatchScore: config.preMatchScore ?? { home: 0, away: 0 },
      generatedAt: new Date().toISOString(),
      targets: {
        shotsTarget: [8, 12],
        goalsTarget: [1, 3],
        foulsTarget: [4, 8],
        cardsTarget: [1, 3]
      }
    },
    ticks,
    finalSummary: {
      finalScore: { ...state.score },
      statistics: {
        home: structuredClone(state.stats.home),
        away: structuredClone(state.stats.away)
      }
    }
  };
}
