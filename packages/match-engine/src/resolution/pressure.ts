import { SUCCESS_PROBABILITIES, TACTIC_MODIFIERS } from "../calibration/probabilities";
import { emitEvent } from "../ticks/runTick";
import { otherTeam, type MutableMatchState, type MutablePlayer } from "../state/matchState";
import type { PressureLevel, TeamId } from "../types";
import { distanceSquared } from "../utils/geometry";
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

export function rollPressureTackle(state: MutableMatchState, carrier: MutablePlayer): boolean {
  const tacklers = eligibleTacklers(state, carrier);

  for (const tackler of tacklers) {
    const tacklerTactics =
      tackler.teamId === "home" ? state.homeTeam.tactics : state.awayTeam.tactics;
    const attemptProbability =
      SUCCESS_PROBABILITIES.tackleAttemptByPressure[state.possession.pressureLevel] *
      TACTIC_MODIFIERS.pressing[tacklerTactics.pressing] *
      (tackler.baseInput.attributes.tackling / 100);

    if (state.rng.next() > attemptProbability) {
      continue;
    }

    const outcome = resolveTackleAttempt(state, tackler, carrier);
    if (outcome === "foul") {
      return true;
    }

    if (outcome === "won") {
      changePossession(state, tackler);
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

function changePossession(state: MutableMatchState, tackler: MutablePlayer): void {
  const previousTeam = otherTeam(tackler.teamId);
  state.players.forEach((player) => {
    player.hasBall = player.id === tackler.id;
  });
  tackler.hasBall = true;
  state.ball.carrierPlayerId = tackler.id;
  state.ball.position = [tackler.position[0], tackler.position[1], 0];
  state.possession.teamId = tackler.teamId;
  emitPossessionChange(state, previousTeam, tackler.teamId, tackler.id);
}

export function emitPossessionChange(
  state: MutableMatchState,
  from: TeamId | null,
  to: TeamId,
  playerId?: string
): void {
  emitEvent(state, "possession_change", to, playerId, { from, to });
}
