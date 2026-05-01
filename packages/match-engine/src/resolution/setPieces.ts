import { GOAL_CENTRE_X, PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
import { emitEvent } from "../ticks/runTick";
import type { MutableMatchState, MutablePlayer, PendingSetPiece } from "../state/matchState";
import { otherTeam } from "../state/matchState";
import type { Coordinate2D, TeamId } from "../types";
import { distanceSquared } from "../utils/geometry";
import { attackDirection } from "../zones/pitchZones";
import { emitPossessionChange } from "./pressure";

const SET_PIECE_DELAY_TICKS = 2;

export function awardThrowIn(
  state: MutableMatchState,
  concedingTeam: TeamId,
  position: Coordinate2D,
  reason: "failed_pass" | "clearance"
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
  emitPossessionChange(state, concedingTeam, teamId, taker.id);
}

export function awardGoalKick(
  state: MutableMatchState,
  teamId: TeamId,
  shooterTeam: TeamId,
  shooterId: string
): void {
  const position = goalKickPosition(teamId);
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
  emitPossessionChange(state, shooterTeam, teamId, keeper.id);
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

  const direction = attackDirection(player.teamId);
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
  emitEvent(state, setPiece.type, setPiece.teamId, setPiece.takerPlayerId, setPiece.detail);
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
  const target = restartTarget(state, setPiece, taker);
  taker.hasBall = false;
  state.ball.carrierPlayerId = null;
  state.ball.targetCarrierPlayerId = target?.id ?? null;
  state.ball.targetPosition = target
    ? [target.position[0], target.position[1], 0]
    : looseTarget(setPiece);
  state.ball.inFlight = true;
}

function restartTarget(
  state: MutableMatchState,
  setPiece: PendingSetPiece,
  taker: MutablePlayer
): MutablePlayer | null {
  const direction = attackDirection(setPiece.teamId);
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

function looseTarget(setPiece: PendingSetPiece): [number, number, number] {
  const direction = attackDirection(setPiece.teamId);
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

function goalKickPosition(teamId: TeamId): Coordinate2D {
  return [GOAL_CENTRE_X, teamId === "home" ? 64 : PITCH_LENGTH - 64];
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
