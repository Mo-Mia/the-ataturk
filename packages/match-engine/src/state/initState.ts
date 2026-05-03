import { PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
import { adaptV2ToV1, isPlayerInputV2 } from "../adapter/v2ToV1";
import type {
  MatchConfig,
  MatchConfigV2,
  PlayerInput,
  PlayerInputV2,
  SetPieceTakers,
  TeamStatistics
} from "../types";
import { createSeededRng } from "../utils/rng";
import { positionTeam } from "../utils/formations";
import {
  emptySetPieceSummary,
  emptyTeamStatistics,
  type MutableMatchState,
  type MutablePlayer
} from "./matchState";
import { urgencyMultiplier } from "./scoreState";

export function buildInitState(config: MatchConfig | MatchConfigV2): MutableMatchState {
  validateConfig(config);

  const isSecondHalf = config.duration === "second_half";
  const dynamics = {
    fatigue: config.dynamics?.fatigue ?? true,
    scoreState: config.dynamics?.scoreState ?? true,
    autoSubs: config.dynamics?.autoSubs ?? true,
    chanceCreation: config.dynamics?.chanceCreation ?? true,
    setPieces: config.dynamics?.setPieces ?? true,
    sideSwitch: config.dynamics?.sideSwitch ?? true
  };
  const players: MutablePlayer[] = [
    ...config.homeTeam.players.map((player) => mutablePlayer(player, "home")),
    ...(config.homeTeam.bench ?? []).map((player) => mutablePlayer(player, "home", false)),
    ...config.awayTeam.players.map((player) => mutablePlayer(player, "away")),
    ...(config.awayTeam.bench ?? []).map((player) => mutablePlayer(player, "away", false))
  ];

  positionTeam(
    players.filter((player) => player.teamId === "home" && player.onPitch),
    config.homeTeam.tactics.formation
  );
  positionTeam(
    players.filter((player) => player.teamId === "away" && player.onPitch),
    config.awayTeam.tactics.formation
  );
  if (isSecondHalf && dynamics.sideSwitch) {
    rotateTeamOrientation(players, "home");
    rotateTeamOrientation(players, "away");
  }

  const state: MutableMatchState = {
    iteration: 0,
    matchClock: { half: isSecondHalf ? 2 : 1, minute: isSecondHalf ? 45 : 0, seconds: 0 },
    duration: config.duration,
    dynamics,
    sideSwitchVersion: dynamics.sideSwitch ? 1 : 0,
    attackDirection:
      isSecondHalf && dynamics.sideSwitch ? { home: -1, away: 1 } : { home: 1, away: -1 },
    seed: config.seed,
    rng: createSeededRng(config.seed),
    homeTeam: config.homeTeam,
    awayTeam: config.awayTeam,
    players,
    ball: {
      position: [PITCH_WIDTH / 2, PITCH_LENGTH / 2, 0],
      targetPosition: null,
      inFlight: false,
      carrierPlayerId: null,
      targetCarrierPlayerId: null
    },
    score: config.preMatchScore ? { ...config.preMatchScore } : { home: 0, away: 0 },
    stats: {
      home: cloneStats(config.preMatchStats?.home, config.preMatchScore?.home ?? 0),
      away: cloneStats(config.preMatchStats?.away, config.preMatchScore?.away ?? 0)
    },
    possession: { teamId: "home", zone: "mid", pressureLevel: "low" },
    possessionTicks: { home: 0, away: 0 },
    possessionStreak: { teamId: null, ticks: 0 },
    attackMomentum: { home: 0, away: 0 },
    substitutions: { home: [], away: [] },
    setPieceTakers: {
      home: selectSetPieceTakers(players, "home"),
      away: selectSetPieceTakers(players, "away")
    },
    setPieceStats: {
      home: emptySetPieceSummary(),
      away: emptySetPieceSummary()
    },
    substitutionCounts: { home: 0, away: 0 },
    lastSubstitutionTick: { home: null, away: null },
    scheduledSubstitutions: [...(config.scheduledSubstitutions ?? [])],
    scoreStateEvents: [
      {
        tick: 0,
        score: config.preMatchScore ? { ...config.preMatchScore } : { home: 0, away: 0 },
        urgency: { home: 1, away: 1 }
      }
    ],
    engineWarnings: players.some((player) => player.staminaSource === "v1-agility")
      ? [
          "One or more v1 players are using agility as the stamina surrogate; provide v2 stamina for calibrated fatigue diagnostics."
        ]
      : [],
    pendingGoal: null,
    pendingSetPiece: null,
    pendingLooseBallCause: null,
    pendingLooseBallPreviousPossessor: null,
    eventsThisTick: [],
    allEvents: [],
    openingKickoffPending: true,
    halfTimeKickoffPending: false,
    halfTimeEmitted: false
  };

  const initialScoreStateEvent = state.scoreStateEvents[0]!;
  state.scoreStateEvents[0] = {
    ...initialScoreStateEvent,
    urgency: {
      home: urgencyMultiplier(state, "home"),
      away: urgencyMultiplier(state, "away")
    }
  };

  giveKickOffToTeam(state, "home");
  return state;
}

export function rotateTeamOrientation(players: MutablePlayer[], teamId: "home" | "away"): void {
  for (const player of players) {
    if (player.teamId !== teamId) {
      continue;
    }
    player.anchorPosition = [
      PITCH_WIDTH - player.anchorPosition[0],
      PITCH_LENGTH - player.anchorPosition[1]
    ];
    player.lateralAnchor = player.anchorPosition[0];
    player.position = [PITCH_WIDTH - player.position[0], PITCH_LENGTH - player.position[1]];
    player.targetPosition = [
      PITCH_WIDTH - player.targetPosition[0],
      PITCH_LENGTH - player.targetPosition[1]
    ];
  }
}

function selectSetPieceTakers(players: MutablePlayer[], teamId: "home" | "away"): SetPieceTakers {
  const teamPlayers = players.filter((player) => player.teamId === teamId && !player.redCard);
  return {
    freeKick: rankedTaker(teamPlayers, freeKickScore)?.id ?? null,
    corner: rankedTaker(teamPlayers, cornerScore)?.id ?? null,
    penalty: rankedTaker(teamPlayers, penaltyScore)?.id ?? null
  };
}

function rankedTaker(
  players: MutablePlayer[],
  score: (player: MutablePlayer) => number
): MutablePlayer | null {
  return (
    players
      .filter((player) => player.baseInput.position !== "GK")
      .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0] ??
    players.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0] ??
    null
  );
}

function freeKickScore(player: MutablePlayer): number {
  if (player.v2Input) {
    const attributes = player.v2Input.attributes;
    return (
      attributes.freeKickAccuracy * 0.45 +
      attributes.shotPower * 0.25 +
      attributes.curve * 0.15 +
      attributes.composure * 0.15
    );
  }
  const attributes = player.baseInput.attributes;
  return (
    attributes.penaltyTaking * 0.35 +
    attributes.shooting * 0.3 +
    attributes.passing * 0.2 +
    attributes.perception * 0.15
  );
}

function cornerScore(player: MutablePlayer): number {
  if (player.v2Input) {
    const attributes = player.v2Input.attributes;
    return attributes.crossing * 0.55 + attributes.vision * 0.25 + attributes.curve * 0.2;
  }
  const attributes = player.baseInput.attributes;
  return attributes.passing * 0.65 + attributes.perception * 0.35;
}

function penaltyScore(player: MutablePlayer): number {
  if (player.v2Input) {
    const attributes = player.v2Input.attributes;
    return attributes.penalties * 0.55 + attributes.composure * 0.3 + attributes.shotPower * 0.15;
  }
  const attributes = player.baseInput.attributes;
  return attributes.penaltyTaking * 0.65 + attributes.perception * 0.35;
}

function mutablePlayer(
  player: PlayerInput | PlayerInputV2,
  teamId: "home" | "away",
  onPitch = true
): MutablePlayer {
  const baseInput = isPlayerInputV2(player) ? adaptV2ToV1(player) : player;
  const staminaAttribute = isPlayerInputV2(player)
    ? player.attributes.stamina
    : baseInput.attributes.agility;

  return {
    id: baseInput.id,
    teamId,
    position: [0, 0],
    targetPosition: [0, 0],
    anchorPosition: [0, 0],
    lateralAnchor: 0,
    hasBall: false,
    onPitch,
    substitutedIn: false,
    substitutedOut: false,
    yellowCards: 0,
    redCard: false,
    lastWideCarryTick: null,
    stamina: 100,
    staminaAttribute,
    staminaSource: isPlayerInputV2(player) ? "v2-stamina" : "v1-agility",
    baseInput,
    ...(isPlayerInputV2(player) ? { v2Input: player } : {})
  };
}

export function giveKickOffToTeam(state: MutableMatchState, teamId: "home" | "away"): void {
  const striker =
    state.players.find(
      (player) => player.teamId === teamId && player.baseInput.position === "ST" && player.onPitch
    ) ??
    state.players.find(
      (player) => player.teamId === teamId && player.baseInput.position !== "GK" && player.onPitch
    ) ??
    state.players.find((player) => player.teamId === teamId && player.onPitch);

  if (!striker) {
    return;
  }

  state.players.forEach((player) => {
    player.hasBall = player.id === striker.id;
  });
  striker.position = [PITCH_WIDTH / 2, PITCH_LENGTH / 2];
  striker.targetPosition = [PITCH_WIDTH / 2, PITCH_LENGTH / 2];
  striker.hasBall = true;
  state.ball.carrierPlayerId = striker.id;
  state.ball.position = [PITCH_WIDTH / 2, PITCH_LENGTH / 2, 0];
}

function cloneStats(stats: TeamStatistics | undefined, scoreGoals: number): TeamStatistics {
  const cloned = stats ? structuredClone(stats) : emptyTeamStatistics();
  cloned.goals = scoreGoals;
  return cloned;
}

function validateConfig(config: MatchConfig | MatchConfigV2): void {
  if (config.homeTeam.players.length !== 11 || config.awayTeam.players.length !== 11) {
    throw new Error("Match engine requires exactly 11 players per team");
  }
  validateBench(config.homeTeam.players, config.homeTeam.bench ?? [], "home");
  validateBench(config.awayTeam.players, config.awayTeam.bench ?? [], "away");
  validateScheduledSubstitutions(config);
}

function validateBench(
  starters: readonly (PlayerInput | PlayerInputV2)[],
  bench: readonly (PlayerInput | PlayerInputV2)[],
  label: string
): void {
  const ids = new Set<string>();
  for (const player of [...starters, ...bench]) {
    if (ids.has(player.id)) {
      throw new Error(`${label} team contains duplicate player id '${player.id}'`);
    }
    ids.add(player.id);
  }
}

function validateScheduledSubstitutions(config: MatchConfig | MatchConfigV2): void {
  const available = {
    home: {
      starters: new Set(config.homeTeam.players.map((player) => player.id)),
      bench: new Set((config.homeTeam.bench ?? []).map((player) => player.id))
    },
    away: {
      starters: new Set(config.awayTeam.players.map((player) => player.id)),
      bench: new Set((config.awayTeam.bench ?? []).map((player) => player.id))
    }
  };
  const usedOut = new Set<string>();
  const usedIn = new Set<string>();
  const counts = { home: 0, away: 0 };

  for (const substitution of config.scheduledSubstitutions ?? []) {
    counts[substitution.teamId] += 1;
    if (counts[substitution.teamId] > 5) {
      throw new Error(`${substitution.teamId} has more than 5 scheduled substitutions`);
    }
    if (!available[substitution.teamId].starters.has(substitution.playerOutId)) {
      throw new Error(
        `Scheduled substitution playerOutId '${substitution.playerOutId}' is not in the starting XI`
      );
    }
    if (!available[substitution.teamId].bench.has(substitution.playerInId)) {
      throw new Error(
        `Scheduled substitution playerInId '${substitution.playerInId}' is not on the bench`
      );
    }
    if (usedOut.has(`${substitution.teamId}:${substitution.playerOutId}`)) {
      throw new Error(
        `Scheduled substitution removes '${substitution.playerOutId}' more than once`
      );
    }
    if (usedIn.has(`${substitution.teamId}:${substitution.playerInId}`)) {
      throw new Error(`Scheduled substitution uses '${substitution.playerInId}' more than once`);
    }
    usedOut.add(`${substitution.teamId}:${substitution.playerOutId}`);
    usedIn.add(`${substitution.teamId}:${substitution.playerInId}`);
  }
}
