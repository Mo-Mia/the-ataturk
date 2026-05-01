import {
  CALIBRATION_TARGETS,
  DETERMINISTIC_GENERATED_AT,
  TICKS_PER_FULL_MATCH,
  TICKS_PER_HALF
} from "./calibration/constants";
import { isPlayerInputV2 } from "./adapter/v2ToV1";
import { buildInitState } from "./state/initState";
import type { MutableMatchState } from "./state/matchState";
import type {
  MatchConfig,
  MatchConfigV2,
  MatchSnapshot,
  MatchTick,
  PlayerInput,
  PlayerInputV2,
  SnapshotRosterPlayer,
  Team,
  TeamV2,
  TeamStatistics
} from "./types";
import { runTick } from "./ticks/runTick";

export function simulateMatch(config: MatchConfig): MatchSnapshot;
export function simulateMatch(config: MatchConfigV2): MatchSnapshot;
export function simulateMatch(config: MatchConfig | MatchConfigV2): MatchSnapshot;
export function simulateMatch(config: MatchConfig | MatchConfigV2): MatchSnapshot {
  const state = buildInitState(config);
  const ticks: MatchTick[] = [];
  const totalTicks = tickCount(config.duration);

  for (let count = 0; count < totalTicks; count += 1) {
    runTick(state);
    ticks.push(toMatchTick(state));
  }

  return buildSnapshot(state, config, ticks);
}

export function simulateMatchStream(
  config: MatchConfig,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick>;
export function simulateMatchStream(
  config: MatchConfigV2,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick>;
export function simulateMatchStream(
  config: MatchConfig | MatchConfigV2,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick>;
export async function* simulateMatchStream(
  config: MatchConfig | MatchConfigV2,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick> {
  const state = buildInitState(config);
  const totalTicks = tickCount(config.duration);

  for (let count = 0; count < totalTicks; count += 1) {
    throwIfAborted(options?.signal);
    runTick(state);
    yield toMatchTick(state);
    await Promise.resolve();
  }
}

function toMatchTick(state: MutableMatchState): MatchTick {
  return {
    iteration: state.iteration,
    matchClock: { ...state.matchClock },
    ball: {
      position: [...state.ball.position],
      inFlight: state.ball.inFlight,
      carrierPlayerId: state.ball.carrierPlayerId
    },
    players: state.players.map((player) => ({
      id: player.id,
      teamId: player.teamId,
      position: [...player.position],
      hasBall: player.hasBall,
      onPitch: player.onPitch
    })),
    score: { ...state.score },
    possession: { teamId: state.possession.teamId, zone: state.possession.zone },
    events: state.eventsThisTick.map(cloneEvent)
  };
}

function buildSnapshot(
  state: MutableMatchState,
  config: MatchConfig | MatchConfigV2,
  ticks: MatchTick[]
): MatchSnapshot {
  return {
    meta: {
      homeTeam: teamMeta(config.homeTeam),
      awayTeam: teamMeta(config.awayTeam),
      rosters: {
        home: roster(config.homeTeam),
        away: roster(config.awayTeam)
      },
      seed: config.seed,
      duration: config.duration,
      preMatchScore: config.preMatchScore ? { ...config.preMatchScore } : { home: 0, away: 0 },
      generatedAt: DETERMINISTIC_GENERATED_AT,
      targets: CALIBRATION_TARGETS
    },
    ticks,
    finalSummary: {
      finalScore: { ...state.score },
      statistics: {
        home: cloneStats(state.stats.home),
        away: cloneStats(state.stats.away)
      }
    }
  };
}

function tickCount(duration: MatchConfig["duration"]): number {
  return duration === "second_half" ? TICKS_PER_HALF : TICKS_PER_FULL_MATCH;
}

function teamMeta(team: Team | TeamV2): { id: string; name: string; shortName: string } {
  return { id: team.id, name: team.name, shortName: team.shortName };
}

function roster(team: Team | TeamV2): SnapshotRosterPlayer[] {
  return team.players.map(rosterPlayer);
}

function rosterPlayer(player: PlayerInput | PlayerInputV2): SnapshotRosterPlayer {
  const base = {
    id: player.id,
    name: player.name,
    shortName: player.shortName,
    ...(player.squadNumber === undefined ? {} : { squadNumber: player.squadNumber }),
    position: player.position
  };

  if (!isPlayerInputV2(player)) {
    return base;
  }

  return {
    ...base,
    ...(player.height === undefined ? {} : { height: player.height }),
    ...(player.weight === undefined ? {} : { weight: player.weight }),
    ...(player.age === undefined ? {} : { age: player.age }),
    preferredFoot: player.preferredFoot,
    weakFootRating: player.weakFootRating,
    skillMovesRating: player.skillMovesRating,
    attributesV2: structuredClone(player.attributes),
    ...(player.gkAttributes ? { gkAttributesV2: structuredClone(player.gkAttributes) } : {})
  };
}

function cloneStats(stats: TeamStatistics): TeamStatistics {
  return structuredClone(stats);
}

function cloneEvent(event: import("./types").SemanticEvent): import("./types").SemanticEvent {
  return {
    type: event.type,
    team: event.team,
    minute: event.minute,
    second: event.second,
    ...(event.playerId ? { playerId: event.playerId } : {}),
    ...(event.detail ? { detail: structuredClone(event.detail) } : {})
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Match simulation aborted", "AbortError");
  }
}
