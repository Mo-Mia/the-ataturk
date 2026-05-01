import { PASS_TARGET_WEIGHTS, SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import { emitEvent } from "../../ticks/runTick";
import type { PassType } from "../../types";
import { distance, distanceSquared } from "../../utils/geometry";
import { flankSide, isWideCarrier, isWideChannelX, isWidePosition } from "../../utils/playerRoles";
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
    carrier.lastWideCarryTick = null;
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

  const deliveryReady = hasRecentWideCarry(state, carrier) || isWideFinalThirdCarrier(carrier);
  const minimumProgress = deliveryReady ? -170 : -35;
  const progressive = teammates.filter(
    (player) => (player.position[1] - carrier.position[1]) * direction > minimumProgress
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
        wideCarrierTargetAdjustment(state, carrier, player, direction) +
        forwardRunBonus(carrier, player, direction) -
        strikerToStrikerPenalty(carrier, player)
    }))
    .sort((a, b) => b.score - a.score);

  const upper = Math.min(weighted.length, 4);
  return weighted[state.rng.int(0, upper - 1)]?.player ?? weighted[0]?.player ?? null;
}

function strikerToStrikerPenalty(carrier: MutablePlayer, candidate: MutablePlayer): number {
  return carrier.baseInput.position === "ST" && candidate.baseInput.position === "ST"
    ? PASS_TARGET_WEIGHTS.strikerToStrikerPenalty
    : 0;
}

function completePass(
  state: MutableMatchState,
  carrier: MutablePlayer,
  target: MutablePlayer
): void {
  carrier.hasBall = false;
  carrier.lastWideCarryTick = null;
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
  carrier.lastWideCarryTick = null;
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
  const wideCandidate = isWidePosition(candidate.baseInput.position);
  const centralCarrier = Math.abs(carrier.position[0] - PITCH_WIDTH / 2) < 150;
  const progressive = (candidate.position[1] - carrier.position[1]) * direction > -60;

  if (!wideCandidate || !centralCarrier || !progressive) {
    return 0;
  }

  return candidate.baseInput.position === "LW" || candidate.baseInput.position === "RW" ? 42 : 26;
}

function wideCarrierTargetAdjustment(
  state: MutableMatchState,
  carrier: MutablePlayer,
  candidate: MutablePlayer,
  direction: 1 | -1
): number {
  if (!isWideCarrier(carrier)) {
    return 0;
  }

  const carrierSide = flankSide(carrier.position[0]);
  const candidateSameFlank =
    flankSide(candidate.position[0]) === carrierSide &&
    (isWideChannelX(candidate.position[0]) || isWidePosition(candidate.baseInput.position));
  const targetCentral = candidate.position[0] > 220 && candidate.position[0] < PITCH_WIDTH - 220;
  const progress = (candidate.position[1] - carrier.position[1]) * direction;
  const targetAttackingZone = zoneForPosition(candidate.teamId, candidate.position) === "att";
  const targetDistanceBand = shotDistanceContext(candidate.teamId, candidate.position).band;
  const shotCapableTarget = ["close", "box", "edge"].includes(targetDistanceBand);
  const attackingRole = isAttackingDeliveryRole(candidate);
  const postCarryDelivery = hasRecentWideCarry(state, carrier);

  let adjustment = 0;
  if (candidateSameFlank && progress > -45) {
    adjustment += PASS_TARGET_WEIGHTS.sameFlankWideSupportBonus;
  }
  if (targetCentral && progress < 95 && !targetAttackingZone) {
    adjustment -= PASS_TARGET_WEIGHTS.wideToCentralBouncePenalty;
  }
  if (targetCentral && targetAttackingZone && progress >= -135 && progress <= 35) {
    adjustment += PASS_TARGET_WEIGHTS.cutbackBonus;
  }
  if (targetCentral && targetAttackingZone && progress > 25 && shotCapableTarget) {
    adjustment += PASS_TARGET_WEIGHTS.attackingCrossBonus;
  }
  if (
    postCarryDelivery &&
    targetCentral &&
    attackingRole &&
    (targetAttackingZone || shotCapableTarget)
  ) {
    adjustment += PASS_TARGET_WEIGHTS.postCarryBoxDeliveryBonus;
  }
  if (postCarryDelivery && targetCentral && !targetAttackingZone && !attackingRole) {
    adjustment -= PASS_TARGET_WEIGHTS.postCarryCentralRecyclePenalty;
  }

  return adjustment;
}

function hasRecentWideCarry(state: MutableMatchState, carrier: MutablePlayer): boolean {
  return (
    carrier.lastWideCarryTick !== null &&
    state.iteration - carrier.lastWideCarryTick <= PASS_TARGET_WEIGHTS.postCarryMomentumTicks
  );
}

function isWideFinalThirdCarrier(carrier: MutablePlayer): boolean {
  return isWideCarrier(carrier) && zoneForPosition(carrier.teamId, carrier.position) === "att";
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
  const context = passContext(state, carrier, target, complete);
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
  state: MutableMatchState,
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
    passType: classifyPass(state, carrier, target, progress, lateralDistance, passDistance),
    complete,
    keyPass,
    progressive
  };
}

function classifyPass(
  state: MutableMatchState,
  carrier: MutablePlayer,
  target: MutablePlayer,
  progress: number,
  lateralDistance: number,
  passDistance: number
): PassType {
  const carrierWide = isWideCarrier(carrier);
  const targetCentral = target.position[0] > 190 && target.position[0] < PITCH_WIDTH - 190;
  const targetAttackingZone = zoneForPosition(target.teamId, target.position) === "att";
  const attackingRole = isAttackingDeliveryRole(target);
  const postCarryDelivery =
    carrierWide && hasRecentWideCarry(state, carrier) && targetCentral && attackingRole;

  if (progress < -35) {
    if (
      carrierWide &&
      targetCentral &&
      (targetAttackingZone || postCarryDelivery) &&
      progress >= -135
    ) {
      return "cutback";
    }
    return "back";
  }
  if (carrierWide && targetCentral && (targetAttackingZone || postCarryDelivery)) {
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

function isAttackingDeliveryRole(player: MutablePlayer): boolean {
  return ["ST", "AM", "LW", "RW", "LM", "RM"].includes(player.baseInput.position);
}
