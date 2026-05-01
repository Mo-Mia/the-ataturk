import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import { emitEvent } from "../../ticks/runTick";
import type { PassType } from "../../types";
import { distance, distanceSquared } from "../../utils/geometry";
import { attackDirection, zoneForPosition } from "../../zones/pitchZones";
import { emitPossessionChange } from "../pressure";
import { awardThrowIn } from "../setPieces";
import { shotDistanceContext } from "../shotDistance";

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
    emitPassEvent(state, carrier, target, true);
    completePass(state, carrier, target);
    return;
  }

  if (state.rng.next() <= SUCCESS_PROBABILITIES.failedPassOutOfPlay) {
    emitPassEvent(state, carrier, target, false);
    awardThrowIn(state, carrier.teamId, carrier.position, "failed_pass", carrier.id);
    return;
  }

  const interceptor = nearestOpponent(state, target);
  if (interceptor) {
    emitPassEvent(state, carrier, target, false);
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
  emitPossessionChange(state, carrier.teamId, interceptor.teamId, interceptor.id, {
    cause: "intercepted_pass",
    previousPossessor: carrier.id,
    zone: zoneForPosition(interceptor.teamId, interceptor.position)
  });
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

function emitPassEvent(
  state: MutableMatchState,
  carrier: MutablePlayer,
  target: MutablePlayer,
  complete: boolean
): void {
  const context = passContext(carrier, target, complete);
  if (
    context.passType === "short" &&
    !context.progressive &&
    !context.keyPass &&
    context.complete
  ) {
    return;
  }

  emitEvent(state, "pass", carrier.teamId, carrier.id, {
    passType: context.passType,
    complete: context.complete,
    keyPass: context.keyPass,
    progressive: context.progressive,
    targetPlayerId: target.id
  });
}

function passContext(
  carrier: MutablePlayer,
  target: MutablePlayer,
  complete: boolean
): {
  passType: PassType;
  complete: boolean;
  keyPass: boolean;
  progressive: boolean;
} {
  const direction = attackDirection(carrier.teamId);
  const progress = (target.position[1] - carrier.position[1]) * direction;
  const lateralDistance = Math.abs(target.position[0] - carrier.position[0]);
  const passDistance = distance(carrier.position, target.position);
  const targetZone = zoneForPosition(target.teamId, target.position);
  const progressive = progress >= PITCH_LENGTH * 0.1;
  const keyPass =
    complete &&
    targetZone === "att" &&
    ["close", "box", "edge"].includes(shotDistanceContext(target.teamId, target.position).band);

  return {
    passType: classifyPass(carrier, target, progress, lateralDistance, passDistance),
    complete,
    keyPass,
    progressive
  };
}

function classifyPass(
  carrier: MutablePlayer,
  target: MutablePlayer,
  progress: number,
  lateralDistance: number,
  passDistance: number
): PassType {
  const carrierWide = carrier.position[0] < 150 || carrier.position[0] > PITCH_WIDTH - 150;
  const targetCentral = target.position[0] > 190 && target.position[0] < PITCH_WIDTH - 190;
  const targetAttackingZone = zoneForPosition(target.teamId, target.position) === "att";
  const attackingRole = ["ST", "AM", "LW", "RW", "LM", "RM"].includes(target.baseInput.position);

  if (progress < -35) {
    return "back";
  }
  if (carrierWide && targetCentral && targetAttackingZone) {
    return "cross";
  }
  if (lateralDistance >= 260) {
    return "switch";
  }
  if (progress >= 150 && attackingRole) {
    return "through_ball";
  }
  if (passDistance >= 230) {
    return "long";
  }
  return "short";
}
