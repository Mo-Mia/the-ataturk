import { GOAL_CENTRE_X, PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
import { SET_PIECES } from "../calibration/probabilities";
import { emitEvent } from "../ticks/runTick";
import type { MutableMatchState, MutablePlayer, PendingSetPiece } from "../state/matchState";
import { otherTeam } from "../state/matchState";
import type { Coordinate2D, TeamId } from "../types";
import { distanceSquared } from "../utils/geometry";
import { attackingGoalY, ownGoalY, zoneForPositionWithDirection } from "../zones/pitchZones";
import { performPenaltyShot, performShot } from "./actions/shot";
import { emitPossessionChange } from "./pressure";
import { shotDistanceContextForDirection } from "./shotDistance";

const SET_PIECE_DELAY_TICKS = 2;

export function awardThrowIn(
  state: MutableMatchState,
  concedingTeam: TeamId,
  position: Coordinate2D,
  reason: "failed_pass" | "clearance",
  previousPossessor?: string
): void {
  const teamId = otherTeam(concedingTeam);
  const touchlineX = position[0] < PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH;
  const throwY = Math.max(35, Math.min(PITCH_LENGTH - 35, position[1]));
  const restartPosition: Coordinate2D = [touchlineX, throwY];
  const taker = nearestPlayerTo(state, teamId, [touchlineX === 0 ? 22 : PITCH_WIDTH - 22, throwY]);
  if (!taker) {
    return;
  }

  awardSetPiece(state, {
    type: "throw_in",
    teamId,
    takerPlayerId: taker.id,
    position: restartPosition,
    ticksUntilRestart: SET_PIECE_DELAY_TICKS,
    detail: { wonFrom: concedingTeam, reason, x: touchlineX, y: throwY }
  });
  emitPossessionChange(state, concedingTeam, teamId, taker.id, {
    cause: "restart_throw_in",
    ...(previousPossessor ? { previousPossessor } : {}),
    zone: zoneForState(state, teamId, taker.position)
  });
}

export function awardGoalKick(
  state: MutableMatchState,
  teamId: TeamId,
  shooterTeam: TeamId,
  shooterId: string
): void {
  const position = goalKickPosition(state, teamId);
  const keeper =
    state.players.find(
      (player) => player.teamId === teamId && player.baseInput.position === "GK" && player.onPitch
    ) ?? nearestPlayerTo(state, teamId, position);
  if (!keeper) {
    return;
  }

  awardSetPiece(state, {
    type: "goal_kick",
    teamId,
    takerPlayerId: keeper.id,
    position,
    ticksUntilRestart: SET_PIECE_DELAY_TICKS,
    detail: { shooterId }
  });
  emitPossessionChange(state, shooterTeam, teamId, keeper.id, {
    cause: "restart_goal_kick",
    previousPossessor: shooterId,
    zone: zoneForState(state, teamId, keeper.position)
  });
}

export function awardCorner(
  state: MutableMatchState,
  teamId: TeamId,
  position: Coordinate2D,
  reason: "deflected_shot" | "defensive_clearance" | "saved_wide" | "blocked_delivery",
  previousPossessor?: string
): void {
  const cornerX = position[0] < PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH;
  const cornerY = attackingGoalY(state.attackDirection[teamId]);
  const restartPosition: Coordinate2D = [cornerX, cornerY];
  const taker = selectedSetPieceTaker(state, teamId, "corner", restartPosition);
  if (!taker) {
    return;
  }

  state.stats[teamId].corners += 1;
  state.setPieceStats[teamId].corners += 1;
  awardSetPiece(state, {
    type: "corner",
    teamId,
    takerPlayerId: taker.id,
    position: restartPosition,
    ticksUntilRestart: SET_PIECE_DELAY_TICKS,
    detail: { reason, previousPossessor }
  });
  emitPossessionChange(state, otherTeam(teamId), teamId, taker.id, {
    cause: "restart_corner",
    ...(previousPossessor ? { previousPossessor } : {}),
    zone: "att"
  });
}

export function awardFreeKick(
  state: MutableMatchState,
  teamId: TeamId,
  takerPlayerId: string,
  position: Coordinate2D,
  fouledBy: string
): void {
  const restartPosition: Coordinate2D = [
    Math.max(35, Math.min(PITCH_WIDTH - 35, position[0])),
    Math.max(35, Math.min(PITCH_LENGTH - 35, position[1]))
  ];
  const taker =
    selectedSetPieceTaker(state, teamId, "freeKick", restartPosition) ??
    state.players.find((player) => player.id === takerPlayerId && player.onPitch) ??
    nearestPlayerTo(state, teamId, restartPosition);
  if (!taker) {
    return;
  }

  awardSetPiece(state, {
    type: "free_kick",
    teamId,
    takerPlayerId: taker.id,
    position: restartPosition,
    ticksUntilRestart: SET_PIECE_DELAY_TICKS,
    detail: { fouledBy }
  });
  emitPossessionChange(state, otherTeam(teamId), teamId, taker.id, {
    cause: "foul_against_carrier",
    previousPossessor: fouledBy,
    zone: zoneForState(state, teamId, taker.position)
  });
}

export function awardPenalty(
  state: MutableMatchState,
  teamId: TeamId,
  fouledBy: string,
  previousPossessor?: string
): void {
  const direction = state.attackDirection[teamId];
  const position: Coordinate2D = [GOAL_CENTRE_X, attackingGoalY(direction) - direction * 120];
  const taker = selectedSetPieceTaker(state, teamId, "penalty", position);
  if (!taker) {
    return;
  }

  state.setPieceStats[teamId].penalties += 1;
  awardSetPiece(state, {
    type: "penalty",
    teamId,
    takerPlayerId: taker.id,
    position,
    ticksUntilRestart: SET_PIECE_DELAY_TICKS,
    detail: { fouledBy, previousPossessor }
  });
  emitPossessionChange(state, otherTeam(teamId), teamId, taker.id, {
    cause: "foul_against_carrier",
    ...(previousPossessor ? { previousPossessor } : {}),
    zone: "att"
  });
}

export function setPieceTargetForPlayer(
  state: MutableMatchState,
  player: MutablePlayer
): Coordinate2D | null {
  const setPiece = state.pendingSetPiece;
  if (!setPiece) {
    return null;
  }

  if (player.id === setPiece.takerPlayerId) {
    return takerPosition(setPiece);
  }

  const direction = state.attackDirection[player.teamId];
  const isSetPieceTeam = player.teamId === setPiece.teamId;
  const lateralOffset = player.anchorPosition[0] < PITCH_WIDTH / 2 ? -70 : 70;
  const depth = isSetPieceTeam ? 120 : 95;
  return [
    player.anchorPosition[0] * 0.65 + (setPiece.position[0] + lateralOffset) * 0.35,
    player.anchorPosition[1] * 0.55 + (setPiece.position[1] + direction * depth) * 0.45
  ];
}

export function continuePendingSetPiece(state: MutableMatchState): boolean {
  const setPiece = state.pendingSetPiece;
  if (!setPiece) {
    return false;
  }

  updateSetPieceBall(state, setPiece);

  if (setPiece.ticksUntilRestart > 0) {
    setPiece.ticksUntilRestart -= 1;
    return true;
  }

  restartSetPiece(state, setPiece);
  state.pendingSetPiece = null;
  return true;
}

function awardSetPiece(state: MutableMatchState, setPiece: PendingSetPiece): void {
  state.players.forEach((player) => {
    player.hasBall = false;
  });
  state.ball.position = [setPiece.position[0], setPiece.position[1], 0];
  state.ball.inFlight = false;
  state.ball.carrierPlayerId = null;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession.teamId = setPiece.teamId;
  state.pendingSetPiece = setPiece;
  if (setPiece.type !== "penalty") {
    emitEvent(state, setPiece.type, setPiece.teamId, setPiece.takerPlayerId, setPiece.detail);
  }
}

function updateSetPieceBall(state: MutableMatchState, setPiece: PendingSetPiece): void {
  state.ball.position = [setPiece.position[0], setPiece.position[1], 0];
  state.ball.inFlight = false;
  state.ball.carrierPlayerId = null;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
}

function restartSetPiece(state: MutableMatchState, setPiece: PendingSetPiece): void {
  const taker = state.players.find(
    (player) => player.id === setPiece.takerPlayerId && player.onPitch
  );
  if (!taker) {
    return;
  }

  taker.targetPosition = takerPosition(setPiece);
  if (setPiece.type === "corner") {
    resolveCorner(state, setPiece, taker);
    return;
  }
  if (setPiece.type === "free_kick" && state.dynamics.setPieces) {
    resolveFreeKick(state, setPiece, taker);
    return;
  }
  if (setPiece.type === "penalty" && state.dynamics.setPieces) {
    resolvePenalty(state, setPiece, taker);
    return;
  }
  const target = restartTarget(state, setPiece, taker);
  taker.hasBall = false;
  state.ball.carrierPlayerId = null;
  state.ball.targetCarrierPlayerId = target?.id ?? null;
  state.ball.targetPosition = target
    ? [target.position[0], target.position[1], 0]
    : looseTarget(state, setPiece);
  state.ball.inFlight = true;
}

function resolveCorner(
  state: MutableMatchState,
  setPiece: PendingSetPiece,
  taker: MutablePlayer
): void {
  const deliveryType = cornerDeliveryType(state, taker);
  emitEvent(state, "corner_taken", setPiece.teamId, taker.id, {
    takerId: taker.id,
    deliveryType
  });
  const receiver = bestAerialTarget(state, setPiece.teamId);
  if (!receiver) {
    resolveLooseSetPiece(state, setPiece);
    return;
  }

  const deliveryQuality = setPieceDeliveryQuality(taker, "corner");
  const receiverQuality = aerialQuality(receiver);
  const shotProbability = Math.min(
    0.78,
    SET_PIECES.cornerShotBase * deliveryQuality * receiverQuality
  );
  if (state.rng.next() > shotProbability) {
    resolveLooseSetPiece(state, setPiece);
    return;
  }

  receiver.position = [
    Math.max(170, Math.min(PITCH_WIDTH - 170, receiver.position[0])),
    attackingGoalY(state.attackDirection[setPiece.teamId]) -
      state.attackDirection[setPiece.teamId] * 145
  ];
  receiver.hasBall = true;
  state.ball.carrierPlayerId = receiver.id;
  state.possession = { teamId: receiver.teamId, zone: "att", pressureLevel: "medium" };
  performShot(state, receiver, {
    source: "set_piece",
    setPieceContext: { type: "corner", takerId: taker.id, deliveryType }
  });
}

function resolveFreeKick(
  state: MutableMatchState,
  setPiece: PendingSetPiece,
  taker: MutablePlayer
): void {
  const distance = shotDistanceContextForDirection(
    state.attackDirection[setPiece.teamId],
    setPiece.position
  ).distanceToGoal;
  const direct = distance <= SET_PIECES.directFreeKickMaxDistance;
  if (direct) {
    state.setPieceStats[setPiece.teamId].directFreeKicks += 1;
  } else {
    state.setPieceStats[setPiece.teamId].indirectFreeKicks += 1;
  }

  const kickType =
    direct && state.rng.next() < SET_PIECES.freeKickDirectShotBase ? "direct" : "crossed";
  emitEvent(state, "free_kick_taken", setPiece.teamId, taker.id, {
    takerId: taker.id,
    kickType
  });

  if (kickType === "direct") {
    taker.position = setPiece.position;
    taker.hasBall = true;
    state.ball.carrierPlayerId = taker.id;
    state.possession = { teamId: taker.teamId, zone: "att", pressureLevel: "low" };
    performShot(state, taker, {
      source: "set_piece",
      setPieceContext: { type: "direct_free_kick", takerId: taker.id }
    });
    return;
  }

  const target = restartTarget(state, setPiece, taker);
  if (target) {
    target.hasBall = true;
    state.ball.carrierPlayerId = target.id;
    state.possession = {
      teamId: target.teamId,
      zone: zoneForState(state, target.teamId, target.position),
      pressureLevel: "medium"
    };
  } else {
    resolveLooseSetPiece(state, setPiece);
  }
}

function resolvePenalty(
  state: MutableMatchState,
  setPiece: PendingSetPiece,
  taker: MutablePlayer
): void {
  emitEvent(state, "penalty_taken", setPiece.teamId, taker.id, {
    takerId: taker.id,
    outcome: "taken"
  });
  taker.position = setPiece.position;
  taker.hasBall = true;
  state.possession = { teamId: taker.teamId, zone: "att", pressureLevel: "low" };
  performPenaltyShot(state, taker, { takerId: taker.id });
}

function resolveLooseSetPiece(state: MutableMatchState, setPiece: PendingSetPiece): void {
  state.ball.carrierPlayerId = null;
  state.ball.targetCarrierPlayerId = null;
  state.ball.targetPosition = looseTarget(state, setPiece);
  state.ball.inFlight = true;
  state.pendingLooseBallCause = "loose_ball_recovered";
  state.pendingLooseBallPreviousPossessor = setPiece.takerPlayerId;
}

function restartTarget(
  state: MutableMatchState,
  setPiece: PendingSetPiece,
  taker: MutablePlayer
): MutablePlayer | null {
  const direction = state.attackDirection[setPiece.teamId];
  const candidates = state.players
    .filter(
      (player) => player.teamId === setPiece.teamId && player.id !== taker.id && player.onPitch
    )
    .map((player) => ({
      player,
      score:
        player.baseInput.attributes.control +
        player.baseInput.attributes.perception -
        Math.sqrt(distanceSquared(player.position, setPiece.position)) / 5 +
        ((player.position[1] - setPiece.position[1]) * direction > 0 ? 28 : 0)
    }))
    .sort((a, b) => b.score - a.score);

  const upper = Math.min(candidates.length, 4);
  return candidates[state.rng.int(0, upper - 1)]?.player ?? candidates[0]?.player ?? null;
}

function looseTarget(
  state: MutableMatchState,
  setPiece: PendingSetPiece
): [number, number, number] {
  const direction = state.attackDirection[setPiece.teamId];
  return [
    Math.max(35, Math.min(PITCH_WIDTH - 35, setPiece.position[0])),
    Math.max(35, Math.min(PITCH_LENGTH - 35, setPiece.position[1] + direction * 180)),
    0
  ];
}

function takerPosition(setPiece: PendingSetPiece): Coordinate2D {
  if (setPiece.type === "throw_in") {
    return [setPiece.position[0] === 0 ? 22 : PITCH_WIDTH - 22, setPiece.position[1]];
  }
  return setPiece.position;
}

function goalKickPosition(state: MutableMatchState, teamId: TeamId): Coordinate2D {
  const direction = state.attackDirection[teamId];
  return [GOAL_CENTRE_X, ownGoalY(direction) + direction * 64];
}

function cornerDeliveryType(
  state: MutableMatchState,
  taker: MutablePlayer
): "in_swinger" | "out_swinger" | "low" {
  const control = taker.baseInput.attributes.control;
  if (control >= taker.baseInput.attributes.passing + 8 && state.rng.next() < 0.24) {
    return "low";
  }
  return state.rng.next() < 0.5 ? "in_swinger" : "out_swinger";
}

function setPieceDeliveryQuality(taker: MutablePlayer, type: "corner" | "freeKick"): number {
  if (taker.v2Input) {
    const attributes = taker.v2Input.attributes;
    const score =
      type === "corner"
        ? attributes.crossing * 0.55 + attributes.vision * 0.25 + attributes.curve * 0.2
        : attributes.freeKickAccuracy * 0.45 +
          attributes.shotPower * 0.25 +
          attributes.curve * 0.15 +
          attributes.composure * 0.15;
    return Math.max(0.55, Math.min(1.28, score / 75));
  }
  const attributes = taker.baseInput.attributes;
  return Math.max(
    0.55,
    Math.min(1.28, (attributes.passing * 0.65 + attributes.perception * 0.35) / 75)
  );
}

function aerialQuality(player: MutablePlayer): number {
  if (player.v2Input) {
    const attributes = player.v2Input.attributes;
    return Math.max(
      0.55,
      Math.min(
        1.35,
        (attributes.headingAccuracy * 0.48 +
          attributes.jumping * 0.32 +
          attributes.strength * 0.2) /
          75
      )
    );
  }
  const attributes = player.baseInput.attributes;
  return Math.max(
    0.55,
    Math.min(1.35, (attributes.jumping * 0.6 + attributes.strength * 0.4) / 75)
  );
}

function bestAerialTarget(state: MutableMatchState, teamId: TeamId): MutablePlayer | null {
  return (
    state.players
      .filter(
        (player) => player.teamId === teamId && player.onPitch && player.baseInput.position !== "GK"
      )
      .sort((a, b) => aerialQuality(b) - aerialQuality(a) || a.id.localeCompare(b.id))[0] ?? null
  );
}

function nearestPlayerTo(
  state: MutableMatchState,
  teamId: TeamId,
  position: Coordinate2D
): MutablePlayer | null {
  return (
    state.players
      .filter((player) => player.teamId === teamId && player.onPitch)
      .sort(
        (a, b) => distanceSquared(a.position, position) - distanceSquared(b.position, position)
      )[0] ?? null
  );
}

export function selectedSetPieceTaker(
  state: MutableMatchState,
  teamId: TeamId,
  role: "freeKick" | "corner" | "penalty",
  fallbackPosition: Coordinate2D
): MutablePlayer | null {
  const preferredId = state.setPieceTakers[teamId][role];
  const preferred = preferredId
    ? state.players.find((player) => player.id === preferredId && player.onPitch)
    : null;
  return preferred ?? nearestPlayerTo(state, teamId, fallbackPosition);
}

function zoneForState(state: MutableMatchState, teamId: TeamId, position: Coordinate2D) {
  return zoneForPositionWithDirection(position, state.attackDirection[teamId]);
}
