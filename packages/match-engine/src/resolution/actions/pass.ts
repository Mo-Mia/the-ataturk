import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import { emitEvent } from "../../ticks/runTick";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import { distanceSquared } from "../../utils/geometry";
import { attackDirection } from "../../zones/pitchZones";
import { emitPossessionChange } from "../pressure";

export function performPass(state: MutableMatchState, carrier: MutablePlayer): void {
  const target = selectPassTarget(state, carrier);
  if (!target) {
    return;
  }

  const completionProbability =
    SUCCESS_PROBABILITIES.passByZone[state.possession.zone] *
    SUCCESS_PROBABILITIES.pressureModifier[state.possession.pressureLevel] *
    (carrier.baseInput.attributes.passing / 100);

  if (state.rng.next() <= completionProbability) {
    completePass(state, carrier, target);
    return;
  }

  if (state.rng.next() <= SUCCESS_PROBABILITIES.failedPassOutOfPlay) {
    awardThrowIn(state, carrier);
    return;
  }

  const interceptor = nearestOpponent(state, target);
  if (interceptor) {
    completeTurnover(state, carrier, interceptor);
  }
}

function selectPassTarget(state: MutableMatchState, carrier: MutablePlayer): MutablePlayer | null {
  const direction = attackDirection(carrier.teamId);
  const teammates = state.players.filter(
    (player) => player.teamId === carrier.teamId && player.id !== carrier.id && player.onPitch
  );

  if (teammates.length === 0) {
    return null;
  }

  const progressive = teammates.filter(
    (player) => (player.position[1] - carrier.position[1]) * direction > -35
  );
  const pool = progressive.length > 0 ? progressive : teammates;
  const weighted = pool
    .map((player) => ({
      player,
      score:
        player.baseInput.attributes.control +
        player.baseInput.attributes.perception -
        Math.sqrt(distanceSquared(player.position, carrier.position)) / 6 +
        widePassBonus(carrier, player, direction) +
        forwardRunBonus(carrier, player, direction)
    }))
    .sort((a, b) => b.score - a.score);

  const upper = Math.min(weighted.length, 4);
  return weighted[state.rng.int(0, upper - 1)]?.player ?? weighted[0]?.player ?? null;
}

function completePass(
  state: MutableMatchState,
  carrier: MutablePlayer,
  target: MutablePlayer
): void {
  carrier.hasBall = false;
  target.hasBall = true;
  state.ball.carrierPlayerId = target.id;
  state.ball.inFlight = true;
  state.ball.targetCarrierPlayerId = target.id;
  state.ball.targetPosition = [target.position[0], target.position[1], 0];
  state.possession.teamId = carrier.teamId;
}

function completeTurnover(
  state: MutableMatchState,
  carrier: MutablePlayer,
  interceptor: MutablePlayer
): void {
  carrier.hasBall = false;
  interceptor.hasBall = true;
  state.ball.carrierPlayerId = interceptor.id;
  state.ball.position = [interceptor.position[0], interceptor.position[1], 0];
  state.possession.teamId = interceptor.teamId;
  emitPossessionChange(state, carrier.teamId, interceptor.teamId, interceptor.id);
}

function nearestOpponent(state: MutableMatchState, target: MutablePlayer): MutablePlayer | null {
  const opponents = state.players
    .filter((player) => player.teamId === otherTeam(target.teamId) && player.onPitch)
    .sort(
      (a, b) =>
        distanceSquared(a.position, target.position) - distanceSquared(b.position, target.position)
    );
  return opponents[0] ?? null;
}

function widePassBonus(
  carrier: MutablePlayer,
  candidate: MutablePlayer,
  direction: 1 | -1
): number {
  const wideCandidate = ["LB", "RB", "LW", "RW"].includes(candidate.baseInput.position);
  const centralCarrier = Math.abs(carrier.position[0] - PITCH_WIDTH / 2) < 150;
  const progressive = (candidate.position[1] - carrier.position[1]) * direction > -60;

  if (!wideCandidate || !centralCarrier || !progressive) {
    return 0;
  }

  return candidate.baseInput.position === "LW" || candidate.baseInput.position === "RW" ? 42 : 26;
}

function forwardRunBonus(
  carrier: MutablePlayer,
  candidate: MutablePlayer,
  direction: 1 | -1
): number {
  const progress = (candidate.position[1] - carrier.position[1]) * direction;
  return progress > 40 ? Math.min(28, progress / 10) : 0;
}

function awardThrowIn(state: MutableMatchState, carrier: MutablePlayer): void {
  carrier.hasBall = false;
  const throwTeam = otherTeam(carrier.teamId);
  const thrower =
    state.players
      .filter((player) => player.teamId === throwTeam && player.onPitch)
      .sort(
        (a, b) =>
          Math.abs(a.position[1] - carrier.position[1]) -
          Math.abs(b.position[1] - carrier.position[1])
      )[0] ?? null;

  const touchlineX = carrier.position[0] < PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH;
  const throwY = Math.max(35, Math.min(PITCH_LENGTH - 35, carrier.position[1]));
  state.ball.position = [touchlineX, throwY, 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;

  if (thrower) {
    thrower.hasBall = true;
    thrower.position = [touchlineX === 0 ? 22 : PITCH_WIDTH - 22, throwY];
    thrower.targetPosition = thrower.position;
    state.ball.carrierPlayerId = thrower.id;
    state.possession.teamId = throwTeam;
    emitEvent(state, "throw_in", throwTeam, thrower.id, {
      wonFrom: carrier.teamId,
      reason: "failed_pass",
      x: touchlineX,
      y: throwY
    });
    emitPossessionChange(state, carrier.teamId, throwTeam, thrower.id);
  }
}
