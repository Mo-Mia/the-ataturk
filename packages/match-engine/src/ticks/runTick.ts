import type { CarrierAction } from "../calibration/probabilities";
import { GOAL_CENTRE_X, PITCH_LENGTH, SECONDS_PER_TICK } from "../calibration/constants";
import {
  executeCarrierAction,
  isVulnerableAction,
  selectCarrierAction
} from "../resolution/carrierAction";
import { restartAfterGoal } from "../resolution/actions/shot";
import { pressureLevel, rollPressureTackle } from "../resolution/pressure";
import { continuePendingSetPiece } from "../resolution/setPieces";
import { giveKickOffToTeam } from "../state/initState";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { updateAttackMomentum } from "../state/momentum";
import type { SemanticEvent, TeamId } from "../types";
import { zoneForPosition } from "../zones/pitchZones";
import { updateBallPhysics } from "./ballPhysics";
import { updateMovement } from "./movement";

export function runTick(state: MutableMatchState): void {
  state.eventsThisTick = [];
  advanceClock(state);

  if (handleHalfTimeBoundary(state)) {
    updateAttackMomentum(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  if (continuePendingGoal(state)) {
    updateAttackMomentum(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }
  if (state.pendingSetPiece) {
    updateMovement(state);
    continuePendingSetPiece(state);
    determinePossessionState(state);
    updateAttackMomentum(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  updateBallPhysics(state);
  updateMovement(state);
  determinePossessionState(state);
  emitOpeningKickoff(state);

  const carrier = currentCarrier(state);
  if (carrier) {
    const action = selectCarrierAction(state, carrier);
    const dispossessed =
      isVulnerableAction(action) &&
      rollPressureTackle(state, carrierForAction(state, carrier), action);

    if (!dispossessed) {
      executeCarrierAction(state, carrierForAction(state, carrier), action);
    }
  }

  if (state.pendingGoal) {
    state.ball.position = [GOAL_CENTRE_X, PITCH_LENGTH / 2, 0];
    updateAttackMomentum(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }
  if (state.pendingSetPiece) {
    updateAttackMomentum(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  determinePossessionState(state);
  updateAttackMomentum(state);
  updatePossessionStats(state);
  state.allEvents.push(...state.eventsThisTick);
}

export function emitEvent(
  state: MutableMatchState,
  type: SemanticEvent["type"],
  team: TeamId,
  playerId?: string,
  detail?: Record<string, unknown>
): void {
  const event: SemanticEvent = {
    type,
    team,
    minute: state.matchClock.minute,
    second: state.matchClock.seconds,
    ...(playerId ? { playerId } : {}),
    ...(detail ? { detail } : {})
  };
  state.eventsThisTick.push(event);
}

function advanceClock(state: MutableMatchState): void {
  state.iteration += 1;
  const baseSeconds = state.duration === "second_half" ? 45 * 60 : 0;
  const elapsed = baseSeconds + state.iteration * SECONDS_PER_TICK;
  state.matchClock = {
    half: elapsed > 45 * 60 ? 2 : 1,
    minute: Math.floor(elapsed / 60),
    seconds: elapsed % 60
  };
}

function determinePossessionState(state: MutableMatchState): void {
  const carrier = currentCarrier(state) ?? claimLooseBall(state);
  if (!carrier) {
    state.possession = { teamId: null, zone: state.possession.zone, pressureLevel: "low" };
    return;
  }

  state.ball.carrierPlayerId = carrier.id;
  state.possession = {
    teamId: carrier.teamId,
    zone: zoneForPosition(carrier.teamId, carrier.position),
    pressureLevel: pressureLevel(state, carrier)
  };
}

function updatePossessionStats(state: MutableMatchState): void {
  if (state.possession.teamId) {
    state.possessionTicks[state.possession.teamId] += 1;
  }

  const total = state.possessionTicks.home + state.possessionTicks.away;
  if (total <= 0) {
    return;
  }

  state.stats.home.possession = Math.round((state.possessionTicks.home / total) * 100);
  state.stats.away.possession = 100 - state.stats.home.possession;
}

function currentCarrier(state: MutableMatchState): MutablePlayer | null {
  return state.players.find((player) => player.hasBall && player.onPitch) ?? null;
}

function claimLooseBall(state: MutableMatchState): MutablePlayer | null {
  if (state.ball.inFlight) {
    return null;
  }

  const nearest = state.players
    .filter((player) => player.onPitch)
    .sort((a, b) => {
      const aDistance =
        (a.position[0] - state.ball.position[0]) ** 2 +
        (a.position[1] - state.ball.position[1]) ** 2;
      const bDistance =
        (b.position[0] - state.ball.position[0]) ** 2 +
        (b.position[1] - state.ball.position[1]) ** 2;
      return aDistance - bDistance;
    })[0];

  if (!nearest) {
    return null;
  }

  const previousTeam = state.possession.teamId;
  const previousPossessor =
    state.pendingLooseBallPreviousPossessor ?? state.ball.carrierPlayerId ?? undefined;
  const cause = state.pendingLooseBallCause ?? "loose_ball_recovered";
  state.players.forEach((player) => {
    player.hasBall = player.id === nearest.id;
  });
  nearest.hasBall = true;
  state.ball.carrierPlayerId = nearest.id;
  state.ball.position = [nearest.position[0], nearest.position[1], 0];

  if (previousTeam && previousTeam !== nearest.teamId) {
    emitEvent(state, "possession_change", nearest.teamId, nearest.id, {
      from: previousTeam,
      to: nearest.teamId,
      cause,
      previousPossessor,
      zone: zoneForPosition(nearest.teamId, nearest.position)
    });
  }
  state.pendingLooseBallCause = null;
  state.pendingLooseBallPreviousPossessor = null;

  return nearest;
}

function carrierForAction(state: MutableMatchState, fallback: MutablePlayer): MutablePlayer {
  return currentCarrier(state) ?? fallback;
}

export function actionIsVulnerableForTest(action: CarrierAction): boolean {
  return isVulnerableAction(action);
}

function emitOpeningKickoff(state: MutableMatchState): void {
  if (!state.openingKickoffPending) {
    emitHalfTimeKickoff(state);
    return;
  }

  state.openingKickoffPending = false;
  const carrier = currentCarrier(state);
  if (!carrier) {
    return;
  }

  emitEvent(state, "kick_off", carrier.teamId, carrier.id, { matchStart: true });
  emitEvent(state, "possession_change", carrier.teamId, carrier.id, {
    from: null,
    to: carrier.teamId,
    cause: "kickoff_match_start",
    zone: zoneForPosition(carrier.teamId, carrier.position)
  });
}

function handleHalfTimeBoundary(state: MutableMatchState): boolean {
  if (state.duration !== "full_90" || state.halfTimeEmitted || state.iteration !== 900) {
    return false;
  }

  state.halfTimeEmitted = true;
  state.halfTimeKickoffPending = true;
  state.pendingGoal = null;
  state.pendingSetPiece = null;
  state.ball.position = [GOAL_CENTRE_X, PITCH_LENGTH / 2, 0];
  state.ball.inFlight = false;
  state.ball.carrierPlayerId = null;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.players.forEach((player) => {
    player.hasBall = false;
    player.targetPosition = player.anchorPosition;
  });
  state.possession.teamId = null;

  emitEvent(state, "half_time", "home", undefined, {
    score: { ...state.score },
    elapsedSeconds: 45 * 60,
    lineups: {
      home: activeLineup(state, "home"),
      away: activeLineup(state, "away")
    },
    possession: {
      home: state.stats.home.possession,
      away: state.stats.away.possession
    }
  });
  giveKickOffToTeam(state, "away");
  state.players.forEach((player) => {
    if (!player.hasBall) {
      player.position = player.anchorPosition;
      player.targetPosition = player.anchorPosition;
    }
  });

  return true;
}

function emitHalfTimeKickoff(state: MutableMatchState): void {
  if (!state.halfTimeKickoffPending) {
    return;
  }

  state.halfTimeKickoffPending = false;
  const carrier = currentCarrier(state);
  if (!carrier) {
    return;
  }

  emitEvent(state, "kick_off", carrier.teamId, carrier.id, { secondHalf: true });
  emitEvent(state, "possession_change", carrier.teamId, carrier.id, {
    from: null,
    to: carrier.teamId,
    cause: "kickoff_second_half",
    zone: zoneForPosition(carrier.teamId, carrier.position)
  });
}

function activeLineup(state: MutableMatchState, teamId: TeamId) {
  return state.players
    .filter((player) => player.teamId === teamId && player.onPitch)
    .map((player) => ({
      id: player.id,
      position: player.baseInput.position,
      x: Math.round(player.position[0]),
      y: Math.round(player.position[1])
    }));
}

function continuePendingGoal(state: MutableMatchState): boolean {
  const pendingGoal = state.pendingGoal;
  if (!pendingGoal) {
    return false;
  }

  state.ball.position = [GOAL_CENTRE_X, PITCH_LENGTH / 2, 0];
  state.ball.inFlight = false;
  state.ball.carrierPlayerId = null;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;

  updateMovement(state);
  state.players.forEach((player) => {
    player.hasBall = false;
  });
  state.possession.teamId = null;

  if (pendingGoal.ticksUntilKickoff > 0) {
    pendingGoal.ticksUntilKickoff -= 1;
    return true;
  }

  restartAfterGoal(state, pendingGoal.restartTeam, pendingGoal.scorerPlayerId);
  state.pendingGoal = null;
  determinePossessionState(state);
  return true;
}
