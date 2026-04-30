import type { CarrierAction } from "../calibration/probabilities";
import { SECONDS_PER_TICK } from "../calibration/constants";
import {
  executeCarrierAction,
  isVulnerableAction,
  selectCarrierAction
} from "../resolution/carrierAction";
import { restartAfterGoal } from "../resolution/actions/shot";
import { pressureLevel, rollPressureTackle } from "../resolution/pressure";
import { continuePendingSetPiece } from "../resolution/setPieces";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import type { SemanticEvent, TeamId } from "../types";
import { zoneForPosition } from "../zones/pitchZones";
import { updateBallPhysics } from "./ballPhysics";
import { updateMovement } from "./movement";

export function runTick(state: MutableMatchState): void {
  state.eventsThisTick = [];
  advanceClock(state);

  if (state.pendingRestartTeam) {
    restartAfterGoal(state, state.pendingRestartTeam);
    determinePossessionState(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  if (state.pendingSetPiece) {
    updateMovement(state);
    continuePendingSetPiece(state);
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  updateBallPhysics(state);
  updateMovement(state);
  determinePossessionState(state);

  const carrier = currentCarrier(state);
  if (carrier) {
    const action = selectCarrierAction(state, carrier);
    const dispossessed =
      isVulnerableAction(action) && rollPressureTackle(state, carrierForAction(state, carrier));

    if (!dispossessed) {
      executeCarrierAction(state, carrierForAction(state, carrier), action);
    }
  }

  if (state.pendingRestartTeam) {
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  if (state.pendingSetPiece) {
    updatePossessionStats(state);
    state.allEvents.push(...state.eventsThisTick);
    return;
  }

  determinePossessionState(state);
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
    half: elapsed >= 45 * 60 ? 2 : 1,
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
  state.players.forEach((player) => {
    player.hasBall = player.id === nearest.id;
  });
  nearest.hasBall = true;
  state.ball.carrierPlayerId = nearest.id;
  state.ball.position = [nearest.position[0], nearest.position[1], 0];

  if (previousTeam && previousTeam !== nearest.teamId) {
    emitEvent(state, "possession_change", nearest.teamId, nearest.id, {
      from: previousTeam,
      to: nearest.teamId
    });
  }

  return nearest;
}

function carrierForAction(state: MutableMatchState, fallback: MutablePlayer): MutablePlayer {
  return currentCarrier(state) ?? fallback;
}

export function actionIsVulnerableForTest(action: CarrierAction): boolean {
  return isVulnerableAction(action);
}
