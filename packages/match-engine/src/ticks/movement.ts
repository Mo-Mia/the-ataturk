import {
  GOAL_CENTRE_X,
  MAX_PLAYER_DELTA_PER_TICK,
  PITCH_LENGTH,
  PITCH_WIDTH
} from "../calibration/constants";
import { setPieceTargetForPlayer } from "../resolution/setPieces";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { attackingThirdProgress } from "../state/momentum";
import type { Coordinate2D, TeamId } from "../types";
import { clamp, clamp2D, distanceSquared, moveTowards } from "../utils/geometry";
import { attackDirection } from "../zones/pitchZones";

const BASE_SPEED_PER_TICK = 10;
const BALL_PRESS_DISTANCE = 230;
const TACKLE_INVOLVEMENT_DISTANCE = 74;
const WIDE_ANCHOR_WEIGHT = 0.85;
const CENTRAL_ANCHOR_WEIGHT = 0.55;
const BALL_SIDE_DEAD_ZONE = 45;
const WIDE_TUCK_IN_POSSESSION = 70;
const WIDE_TUCK_OUT_OF_POSSESSION = 72;
const WIDE_CHANNEL_INNER_LEFT = 245;
const WIDE_CHANNEL_INNER_RIGHT = PITCH_WIDTH - WIDE_CHANNEL_INNER_LEFT;

export function updateMovement(state: MutableMatchState): void {
  const carrier = currentCarrier(state);
  const ballPosition: Coordinate2D = [state.ball.position[0], state.ball.position[1]];

  for (const player of state.players) {
    if (!player.onPitch) {
      continue;
    }

    player.targetPosition = targetForPlayer(state, player, ballPosition, carrier);
    const speed = speedForPlayer(player, state);
    player.position = moveTowards(player.position, player.targetPosition, speed);
  }

  const updatedCarrier = currentCarrier(state);
  if (updatedCarrier) {
    state.ball.position = [updatedCarrier.position[0], updatedCarrier.position[1], 0];
  }
}

function targetForPlayer(
  state: MutableMatchState,
  player: MutablePlayer,
  ballPosition: Coordinate2D,
  carrier: MutablePlayer | null
): Coordinate2D {
  const direction = attackDirection(player.teamId);
  const goalResetTarget = goalResetTargetForPlayer(state, player);
  if (goalResetTarget) {
    return clamp2D(goalResetTarget, PITCH_WIDTH, PITCH_LENGTH);
  }

  const setPieceTarget = setPieceTargetForPlayer(state, player);
  if (setPieceTarget) {
    return clamp2D(setPieceTarget, PITCH_WIDTH, PITCH_LENGTH);
  }

  if (player.hasBall) {
    return clamp2D(
      [
        player.position[0],
        player.position[1] + direction * (14 + player.baseInput.attributes.control / 9)
      ],
      PITCH_WIDTH,
      PITCH_LENGTH
    );
  }

  const teamInPossession = state.possession.teamId;
  const tactics = player.teamId === "home" ? state.homeTeam.tactics : state.awayTeam.tactics;
  const lineShift = lineHeightShift(tactics.lineHeight) * direction;
  const mentalityShift =
    mentalityShiftForTeam(tactics.mentality, player.teamId, teamInPossession) * direction;
  const widthScale = widthScaleForTeam(tactics.width);
  const anchorX = PITCH_WIDTH / 2 + (player.anchorPosition[0] - PITCH_WIDTH / 2) * widthScale;
  const dynamicAnchorX = dynamicLateralAnchor(
    player,
    anchorX,
    ballPosition,
    teamInPossession === player.teamId
  );
  let target: Coordinate2D = [
    dynamicAnchorX,
    player.anchorPosition[1] + lineShift + mentalityShift
  ];

  if (teamInPossession === player.teamId) {
    target = supportingTarget(state, player, target, carrier, direction, ballPosition);
  } else if (
    teamInPossession &&
    distanceSquared(player.position, ballPosition) < BALL_PRESS_DISTANCE ** 2
  ) {
    target = defensiveTarget(player, ballPosition, tactics.pressing);
  }

  return clamp2D(
    applyLateralDiscipline(state, player, carrier, target, dynamicAnchorX),
    PITCH_WIDTH,
    PITCH_LENGTH
  );
}

function supportingTarget(
  state: MutableMatchState,
  player: MutablePlayer,
  anchorTarget: Coordinate2D,
  carrier: MutablePlayer | null,
  direction: 1 | -1,
  ballPosition: Coordinate2D
): Coordinate2D {
  if (!carrier) {
    return addOffBallPulse(state, player, anchorTarget, 0.45);
  }

  const momentum = state.attackMomentum[player.teamId];
  const progress = attackingThirdProgress(carrier.teamId, carrier.position[1]);
  const supportY =
    carrier.position[1] + direction * verticalSupportOffset(player, momentum, progress, carrier);
  const supportX = anchorTarget[0] + (carrier.position[0] - PITCH_WIDTH / 2) * 0.12;
  const supportInfluence = supportInfluenceForPlayer(player, momentum, progress);
  const supportTarget: Coordinate2D = [
    supportX,
    anchorTarget[1] * (1 - supportInfluence) + supportY * supportInfluence
  ];

  return addOffBallPulse(
    state,
    player,
    channelRunTarget(state, player, supportTarget, direction, ballPosition, carrier),
    1
  );
}

function defensiveTarget(
  player: MutablePlayer,
  ballPosition: Coordinate2D,
  pressing: "low" | "medium" | "high"
): Coordinate2D {
  const intensity = pressing === "high" ? 0.72 : pressing === "medium" ? 0.52 : 0.34;
  return [
    player.anchorPosition[0] * (1 - intensity) + ballPosition[0] * intensity,
    player.anchorPosition[1] * (1 - intensity) + ballPosition[1] * intensity
  ];
}

function speedForPlayer(player: MutablePlayer, state: MutableMatchState): number {
  if (state.pendingGoal || state.pendingSetPiece) {
    return MAX_PLAYER_DELTA_PER_TICK;
  }

  const tactics = player.teamId === "home" ? state.homeTeam.tactics : state.awayTeam.tactics;
  const tempo = tactics.tempo === "fast" ? 1.12 : tactics.tempo === "slow" ? 0.92 : 1;
  return Math.min(
    MAX_PLAYER_DELTA_PER_TICK,
    (BASE_SPEED_PER_TICK + player.baseInput.attributes.agility / 6) * tempo
  );
}

function currentCarrier(state: MutableMatchState): MutablePlayer | null {
  return state.players.find((player) => player.hasBall && player.onPitch) ?? null;
}

function lineHeightShift(lineHeight: "deep" | "normal" | "high"): number {
  if (lineHeight === "high") {
    return 55;
  }
  if (lineHeight === "deep") {
    return -45;
  }
  return 0;
}

function mentalityShiftForTeam(
  mentality: "defensive" | "balanced" | "attacking",
  teamId: TeamId,
  teamInPossession: TeamId | null
): number {
  if (mentality === "attacking") {
    return teamInPossession === teamId ? 60 : 25;
  }
  if (mentality === "defensive") {
    return teamInPossession === teamId ? 10 : -45;
  }
  return teamInPossession === teamId ? 30 : 0;
}

function widthScaleForTeam(width: "narrow" | "normal" | "wide"): number {
  if (width === "wide") {
    return 1.12;
  }
  if (width === "narrow") {
    return 0.78;
  }
  return 1;
}

function goalResetTargetForPlayer(
  state: MutableMatchState,
  player: MutablePlayer
): Coordinate2D | null {
  const pendingGoal = state.pendingGoal;
  if (!pendingGoal) {
    return null;
  }

  if (player.id === kickoffReceiverId(state, pendingGoal.restartTeam)) {
    return kickoffTargetForTeam(pendingGoal.restartTeam);
  }

  return player.anchorPosition;
}

function kickoffTargetForTeam(teamId: TeamId): Coordinate2D {
  const direction = attackDirection(teamId);
  return [GOAL_CENTRE_X, PITCH_LENGTH / 2 - direction * 18];
}

function kickoffReceiverId(state: MutableMatchState, teamId: TeamId): string | null {
  return (
    state.players.find(
      (player) => player.teamId === teamId && player.baseInput.position === "ST" && player.onPitch
    )?.id ??
    state.players.find((player) => player.teamId === teamId && player.onPitch)?.id ??
    null
  );
}

function applyLateralDiscipline(
  state: MutableMatchState,
  player: MutablePlayer,
  carrier: MutablePlayer | null,
  target: Coordinate2D,
  dynamicAnchorX: number
): Coordinate2D {
  if (!carrier || directlyInvolvedInPlay(state, player, carrier)) {
    return target;
  }

  const weight = widePosition(player) ? WIDE_ANCHOR_WEIGHT : CENTRAL_ANCHOR_WEIGHT;
  return [target[0] * (1 - weight) + dynamicAnchorX * weight, target[1]];
}

function directlyInvolvedInPlay(
  state: MutableMatchState,
  player: MutablePlayer,
  carrier: MutablePlayer
): boolean {
  if (player.id === carrier.id) {
    return true;
  }

  if (distanceSquared(player.position, carrier.position) <= TACKLE_INVOLVEMENT_DISTANCE ** 2) {
    return true;
  }

  return closestOppositionDefenderId(state, carrier) === player.id;
}

function closestOppositionDefenderId(
  state: MutableMatchState,
  carrier: MutablePlayer
): string | null {
  return (
    state.players
      .filter((player) => player.teamId !== carrier.teamId && player.onPitch)
      .sort(
        (a, b) =>
          distanceSquared(a.position, carrier.position) -
          distanceSquared(b.position, carrier.position)
      )[0]?.id ?? null
  );
}

function widePosition(player: MutablePlayer): boolean {
  return ["LB", "RB", "LM", "RM", "LW", "RW"].includes(player.baseInput.position);
}

function verticalSupportOffset(
  player: MutablePlayer,
  momentum: number,
  progress: number,
  carrier: MutablePlayer
): number {
  if (player.baseInput.position === "GK") {
    return -360;
  }
  if (player.baseInput.position === "ST") {
    return -45;
  }
  if (player.baseInput.position === "AM") {
    return momentum >= 22 && progress >= 0.5 ? 10 : -75;
  }
  if (["LW", "RW", "LM", "RM"].includes(player.baseInput.position)) {
    return momentum >= 22 && progress >= 0.52 ? 36 : -75;
  }
  if (["LB", "RB"].includes(player.baseInput.position)) {
    return shouldFullBackOverlap(player, carrier, momentum, progress) ? 62 : -140;
  }
  if (player.baseInput.position === "CM") {
    return momentum >= 26 && progress >= 0.5 ? 10 : -105;
  }
  if (player.baseInput.position === "DM") {
    return momentum >= 45 && progress >= 0.62 ? -38 : -115;
  }
  return -150;
}

function supportInfluenceForPlayer(
  player: MutablePlayer,
  momentum: number,
  progress: number
): number {
  if (player.baseInput.position === "GK") {
    return 0.1;
  }
  if (player.baseInput.position === "ST" || player.baseInput.position === "AM") {
    return momentum >= 22 && progress >= 0.5 ? 0.58 : 0.45;
  }
  if (["LW", "RW", "LM", "RM"].includes(player.baseInput.position)) {
    return momentum >= 22 && progress >= 0.52 ? 0.64 : 0.45;
  }
  if (["LB", "RB"].includes(player.baseInput.position)) {
    return momentum >= 24 && progress >= 0.5 ? 0.6 : 0.35;
  }
  if (player.baseInput.position === "CM") {
    return momentum >= 26 && progress >= 0.5 ? 0.56 : 0.45;
  }
  if (player.baseInput.position === "DM") {
    return momentum >= 45 && progress >= 0.62 ? 0.42 : 0.28;
  }
  return 0.22;
}

function channelRunTarget(
  state: MutableMatchState,
  player: MutablePlayer,
  target: Coordinate2D,
  direction: 1 | -1,
  ballPosition: Coordinate2D,
  carrier: MutablePlayer | null
): Coordinate2D {
  if (["LW", "RW", "LM", "RM", "LB", "RB"].includes(player.baseInput.position)) {
    return wideRunTarget(state, player, target, direction, ballPosition, carrier);
  }

  if (player.baseInput.position === "ST" || player.baseInput.position === "AM") {
    return [
      target[0] + (player.anchorPosition[0] - PITCH_WIDTH / 2) * 0.18,
      target[1] + direction * 28
    ];
  }

  return target;
}

function dynamicLateralAnchor(
  player: MutablePlayer,
  baseAnchorX: number,
  ballPosition: Coordinate2D,
  inPossession: boolean
): number {
  if (player.baseInput.position === "GK") {
    return baseAnchorX;
  }

  const side = ballSide(ballPosition[0]);
  if (side === "centre") {
    return baseAnchorX;
  }

  const shift = ballSideShift(player, inPossession) * (side === "left" ? -1 : 1);
  let dynamicX = baseAnchorX + shift;

  if (widePosition(player) && playerSide(baseAnchorX) !== side) {
    const tuck = inPossession ? WIDE_TUCK_IN_POSSESSION : WIDE_TUCK_OUT_OF_POSSESSION;
    dynamicX += baseAnchorX < PITCH_WIDTH / 2 ? tuck : -tuck;
    dynamicX = clampWideChannel(player, dynamicX);
  }

  return dynamicX;
}

function ballSide(x: number): "left" | "right" | "centre" {
  if (Math.abs(x - PITCH_WIDTH / 2) <= BALL_SIDE_DEAD_ZONE) {
    return "centre";
  }
  return x < PITCH_WIDTH / 2 ? "left" : "right";
}

function playerSide(x: number): "left" | "right" {
  return x < PITCH_WIDTH / 2 ? "left" : "right";
}

function ballSideShift(player: MutablePlayer, inPossession: boolean): number {
  if (["CB", "LB", "RB", "GK"].includes(player.baseInput.position)) {
    return inPossession ? 22 : 26;
  }
  if (["DM", "CM", "AM", "LM", "RM"].includes(player.baseInput.position)) {
    return inPossession ? 34 : 32;
  }
  return inPossession ? 24 : 22;
}

function clampWideChannel(player: MutablePlayer, x: number): number {
  return player.anchorPosition[0] < PITCH_WIDTH / 2
    ? clamp(x, 35, WIDE_CHANNEL_INNER_LEFT)
    : clamp(x, WIDE_CHANNEL_INNER_RIGHT, PITCH_WIDTH - 35);
}

function wideRunTarget(
  state: MutableMatchState,
  player: MutablePlayer,
  target: Coordinate2D,
  direction: 1 | -1,
  ballPosition: Coordinate2D,
  carrier: MutablePlayer | null
): Coordinate2D {
  const side = ballSide(ballPosition[0]);
  const ownSide = playerSide(player.anchorPosition[0]);
  const centralCarrier = carrier ? Math.abs(carrier.position[0] - PITCH_WIDTH / 2) < 145 : false;
  const nearSide = side !== "centre" && side === ownSide;
  const farSide = side !== "centre" && side !== ownSide;
  const momentum = state.attackMomentum[player.teamId];
  const progress = carrier ? attackingThirdProgress(carrier.teamId, carrier.position[1]) : 0;
  const verticalBoost = momentum >= 24 && progress >= 0.5 ? 24 : 0;

  if (nearSide && centralCarrier && ["LW", "RW", "LM", "RM"].includes(player.baseInput.position)) {
    const channelX = ownSide === "left" ? 82 : PITCH_WIDTH - 82;
    return [channelX, target[1] + direction * (58 + verticalBoost)];
  }

  if (
    nearSide &&
    centralCarrier &&
    ["LB", "RB"].includes(player.baseInput.position) &&
    carrier &&
    shouldFullBackOverlap(player, carrier, momentum, progress)
  ) {
    const overlapX = ownSide === "left" ? 42 : PITCH_WIDTH - 42;
    return [overlapX, target[1] + direction * (72 + verticalBoost)];
  }

  if (farSide && ["LW", "RW", "LM", "RM"].includes(player.baseInput.position)) {
    const backPostX = ownSide === "left" ? WIDE_CHANNEL_INNER_LEFT : WIDE_CHANNEL_INNER_RIGHT;
    return [backPostX, target[1] + direction * 34];
  }

  return [target[0], target[1] + direction * 18];
}

function shouldFullBackOverlap(
  player: MutablePlayer,
  carrier: MutablePlayer,
  momentum: number,
  progress: number
): boolean {
  if (!["LB", "RB"].includes(player.baseInput.position)) {
    return false;
  }

  const sameSideCarrier =
    Math.abs(carrier.position[0] - PITCH_WIDTH / 2) <= 145 ||
    playerSide(player.anchorPosition[0]) === playerSide(carrier.position[0]);
  return momentum >= 24 && progress >= 0.5 && sameSideCarrier;
}

function addOffBallPulse(
  state: MutableMatchState,
  player: MutablePlayer,
  target: Coordinate2D,
  intensity: number
): Coordinate2D {
  if (player.baseInput.position === "GK") {
    return target;
  }

  const phase = hashPlayerId(player.id) % 17;
  const wave = Math.sin((state.iteration + phase) / 9);
  const lateral = Math.cos((state.iteration + phase) / 13);
  const roleMultiplier = ["LW", "RW", "LM", "RM", "ST", "AM"].includes(player.baseInput.position)
    ? 1.35
    : 0.8;

  return [
    target[0] + lateral * 14 * intensity * roleMultiplier,
    target[1] + wave * 18 * intensity * roleMultiplier
  ];
}

function hashPlayerId(playerId: string): number {
  let hash = 0;
  for (const char of playerId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}
