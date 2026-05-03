import {
  CALIBRATION_TARGETS,
  DETERMINISTIC_GENERATED_AT,
  PITCH_LENGTH,
  PITCH_WIDTH,
  TICKS_PER_FULL_MATCH,
  TICKS_PER_HALF
} from "./calibration/constants";
import { isPlayerInputV2 } from "./adapter/v2ToV1";
import type { MutableMatchState } from "./state/matchState";
import { emitEvent } from "./ticks/runTick";
import type {
  AttackDirection,
  MatchConfig,
  MatchConfigV2,
  MatchSnapshot,
  MatchTick,
  PlayerInput,
  PlayerInputV2,
  SnapshotRosterPlayer,
  Team,
  TeamId,
  TeamShapeDiagnostics,
  TeamStatistics,
  TeamV2
} from "./types";
import { normalisedAttackingY } from "./zones/pitchZones";

export function emitFullTime(state: MutableMatchState): void {
  emitEvent(state, "full_time", "home", undefined, {
    finalScore: { ...state.score },
    possession: {
      home: state.stats.home.possession,
      away: state.stats.away.possession
    }
  });
  state.allEvents.push(state.eventsThisTick[state.eventsThisTick.length - 1]!);
}

export function toMatchTick(state: MutableMatchState): MatchTick {
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
      onPitch: player.onPitch,
      stamina: Math.round(player.stamina)
    })),
    score: { ...state.score },
    possession: { teamId: state.possession.teamId, zone: state.possession.zone },
    attackMomentum: { ...state.attackMomentum },
    possessionStreak: { ...state.possessionStreak },
    attackDirection: { ...state.attackDirection },
    diagnostics: {
      shape: {
        home: teamShapeDiagnostics(state, "home"),
        away: teamShapeDiagnostics(state, "away")
      }
    },
    events: state.eventsThisTick.map(cloneEvent)
  };
}

export function buildSnapshot(
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
      sideSwitchVersion: state.sideSwitchVersion,
      targets: CALIBRATION_TARGETS,
      diagnostics: {
        warnings: [...state.engineWarnings]
      }
    },
    ticks,
    finalSummary: {
      finalScore: { ...state.score },
      statistics: {
        home: cloneStats(state.stats.home),
        away: cloneStats(state.stats.away)
      },
      endStamina: {
        home: endStamina(state, "home"),
        away: endStamina(state, "away")
      },
      substitutions: {
        home: [...state.substitutions.home],
        away: [...state.substitutions.away]
      },
      scoreStateEvents: structuredClone(state.scoreStateEvents),
      setPieceTakers: structuredClone(state.setPieceTakers),
      setPieces: structuredClone(state.setPieceStats)
    }
  };
}

export function tickCount(duration: MatchConfig["duration"]): number {
  return duration === "second_half" ? TICKS_PER_HALF : TICKS_PER_FULL_MATCH;
}

function teamMeta(team: Team | TeamV2): { id: string; name: string; shortName: string } {
  return { id: team.id, name: team.name, shortName: team.shortName };
}

function roster(team: Team | TeamV2): SnapshotRosterPlayer[] {
  return [...team.players, ...(team.bench ?? [])].map(rosterPlayer);
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

function endStamina(state: MutableMatchState, teamId: TeamId) {
  return state.players
    .filter((player) => player.teamId === teamId)
    .map((player) => ({ playerId: player.id, stamina: Math.round(player.stamina) }));
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

function teamShapeDiagnostics(state: MutableMatchState, teamId: TeamId): TeamShapeDiagnostics {
  const players = state.players.filter((player) => player.teamId === teamId && player.onPitch);
  const normalisedY = players.map((player) =>
    normaliseY(state.attackDirection[teamId], player.position[1])
  );
  const xs = players.map((player) => player.position[0]);
  const centroid = centroidFor(players.map((player) => player.position));
  const ballSide = state.ball.position[0] < PITCH_WIDTH / 2 ? "left" : "right";

  return {
    activePlayers: players.length,
    lineHeight: {
      team: roundedAverage(normalisedY) ?? 0,
      defence: roundedAverage(lineY(players, state.attackDirection[teamId], "defence")),
      midfield: roundedAverage(lineY(players, state.attackDirection[teamId], "midfield")),
      attack: roundedAverage(lineY(players, state.attackDirection[teamId], "attack"))
    },
    spread: {
      width: roundedRange(xs),
      depth: roundedRange(normalisedY),
      compactness: Math.round(
        average(
          players.map(
            (player) =>
              ((player.position[0] - centroid[0]) ** 2 + (player.position[1] - centroid[1]) ** 2) **
              0.5
          )
        )
      )
    },
    thirds: thirdsFor(normalisedY),
    oppositionHalfPlayers: normalisedY.filter((y) => y > PITCH_LENGTH / 2).length,
    ballSidePlayers: players.filter((player) =>
      ballSide === "left"
        ? player.position[0] < PITCH_WIDTH / 2
        : player.position[0] >= PITCH_WIDTH / 2
    ).length
  };
}

function lineY(
  players: MutableMatchState["players"],
  direction: AttackDirection,
  line: "defence" | "midfield" | "attack"
): number[] {
  return players
    .filter((player) => playerLine(player.baseInput.position) === line)
    .map((player) => normaliseY(direction, player.position[1]));
}

function playerLine(position: import("./types").Position): "defence" | "midfield" | "attack" {
  if (["GK", "CB", "LB", "RB"].includes(position)) {
    return "defence";
  }
  if (["ST", "LW", "RW"].includes(position)) {
    return "attack";
  }
  return "midfield";
}

function normaliseY(direction: AttackDirection, y: number): number {
  return normalisedAttackingY(y, direction);
}

function thirdsFor(normalisedY: number[]): TeamShapeDiagnostics["thirds"] {
  return {
    defensive: normalisedY.filter((y) => y < PITCH_LENGTH / 3).length,
    middle: normalisedY.filter((y) => y >= PITCH_LENGTH / 3 && y <= (PITCH_LENGTH * 2) / 3).length,
    attacking: normalisedY.filter((y) => y > (PITCH_LENGTH * 2) / 3).length
  };
}

function centroidFor(points: Array<[number, number]>): [number, number] {
  if (points.length === 0) {
    return [PITCH_WIDTH / 2, PITCH_LENGTH / 2];
  }
  return [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length
  ];
}

function roundedAverage(values: number[]): number | null {
  return values.length === 0 ? null : Math.round(average(values));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundedRange(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return Math.round(Math.max(...values) - Math.min(...values));
}
