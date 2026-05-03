import { SCORE_STATE, SUCCESS_PROBABILITIES, TACTIC_MODIFIERS } from "../calibration/probabilities";
import { emitEvent } from "../ticks/runTick";
import { otherTeam, type MutableMatchState, type MutablePlayer } from "../state/matchState";
import {
  applyActionFatigue,
  applyPressingFatigue,
  staminaEffectMultiplier
} from "../state/stamina";
import { urgencyMultiplier } from "../state/scoreState";
import type { PossessionChangeCause, PressureLevel, TeamId, Zone } from "../types";
import { distanceSquared } from "../utils/geometry";
import { zoneForPositionWithDirection } from "../zones/pitchZones";
import type { CarrierAction } from "../calibration/probabilities";
import { resolveTackleAttempt } from "./actions/tackle";

const TACKLE_RANGE = 74;

export function pressureLevel(state: MutableMatchState, carrier: MutablePlayer): PressureLevel {
  const nearby = state.players.filter(
    (player) =>
      player.teamId !== carrier.teamId &&
      player.onPitch &&
      distanceSquared(player.position, carrier.position) <= TACKLE_RANGE ** 2
  ).length;

  if (nearby >= 2) {
    return "high";
  }
  if (nearby === 1) {
    return "medium";
  }
  return "low";
}

export function rollPressureTackle(
  state: MutableMatchState,
  carrier: MutablePlayer,
  carrierAction: CarrierAction = "hold"
): boolean {
  const tacklers = eligibleTacklers(state, carrier);

  for (const tackler of tacklers) {
    const tacklerTactics =
      tackler.teamId === "home" ? state.homeTeam.tactics : state.awayTeam.tactics;
    const attemptProbability =
      SUCCESS_PROBABILITIES.tackleAttemptByPressure[state.possession.pressureLevel] *
      TACTIC_MODIFIERS.pressing[tacklerTactics.pressing] *
      Math.max(0.2, 1 + (urgencyMultiplier(state, tackler.teamId) - 1) * SCORE_STATE.pressing) *
      (tackler.baseInput.attributes.tackling / 100) *
      staminaEffectMultiplier(tackler);
    if (state.dynamics.fatigue) {
      applyPressingFatigue(tackler);
    }

    if (state.rng.next() > attemptProbability) {
      continue;
    }

    if (state.dynamics.fatigue) {
      applyActionFatigue(tackler, "tackle");
    }
    const outcome = resolveTackleAttempt(state, tackler, carrier, { carrierAction });
    if (outcome === "foul") {
      return true;
    }

    if (outcome === "won") {
      changePossession(state, tackler, carrier.id);
      return true;
    }
  }

  return false;
}

function eligibleTacklers(state: MutableMatchState, carrier: MutablePlayer): MutablePlayer[] {
  return state.players
    .filter(
      (player) =>
        player.teamId !== carrier.teamId &&
        player.onPitch &&
        distanceSquared(player.position, carrier.position) <= TACKLE_RANGE ** 2
    )
    .sort(
      (a, b) =>
        distanceSquared(a.position, carrier.position) -
        distanceSquared(b.position, carrier.position)
    );
}

function changePossession(
  state: MutableMatchState,
  tackler: MutablePlayer,
  previousPossessor: string
): void {
  const previousTeam = otherTeam(tackler.teamId);
  state.players.forEach((player) => {
    player.hasBall = player.id === tackler.id;
  });
  tackler.hasBall = true;
  state.ball.carrierPlayerId = tackler.id;
  state.ball.position = [tackler.position[0], tackler.position[1], 0];
  state.possession.teamId = tackler.teamId;
  emitPossessionChange(state, previousTeam, tackler.teamId, tackler.id, {
    cause: "successful_tackle",
    previousPossessor
  });
}

export function emitPossessionChange(
  state: MutableMatchState,
  from: TeamId | null,
  to: TeamId,
  playerId?: string,
  detail: { cause?: PossessionChangeCause; previousPossessor?: string; zone?: Zone } = {}
): void {
  const player = playerId ? state.players.find((candidate) => candidate.id === playerId) : null;
  emitEvent(state, "possession_change", to, playerId, {
    from,
    to,
    ...detail,
    zone:
      detail.zone ??
      (player
        ? zoneForPositionWithDirection(player.position, state.attackDirection[to])
        : state.possession.zone)
  });
}
