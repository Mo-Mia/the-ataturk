import { PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
import { setPieceTargetForPlayer } from "../resolution/setPieces";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import type { Coordinate2D, TeamId } from "../types";
import { clamp, clamp2D, distanceSquared, moveTowards } from "../utils/geometry";
import { attackDirection } from "../zones/pitchZones";

const BASE_SPEED_PER_TICK = 10;
const BALL_PRESS_DISTANCE = 230;

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
  let target: Coordinate2D = [anchorX, player.anchorPosition[1] + lineShift + mentalityShift];

  if (teamInPossession === player.teamId) {
    target = supportingTarget(state, player, target, carrier, direction);
  } else if (
    teamInPossession &&
    distanceSquared(player.position, ballPosition) < BALL_PRESS_DISTANCE ** 2
  ) {
    target = defensiveTarget(player, ballPosition, tactics.pressing);
  }

  return clamp2D(target, PITCH_WIDTH, PITCH_LENGTH);
}

function supportingTarget(
  state: MutableMatchState,
  player: MutablePlayer,
  anchorTarget: Coordinate2D,
  carrier: MutablePlayer | null,
  direction: 1 | -1
): Coordinate2D {
  if (!carrier) {
    return addOffBallPulse(state, player, anchorTarget, 0.45);
  }

  const supportY = carrier.position[1] - direction * supportDepth(player);
  const supportX = anchorTarget[0] + (carrier.position[0] - PITCH_WIDTH / 2) * 0.12;
  const supportTarget: Coordinate2D = [supportX, anchorTarget[1] * 0.55 + supportY * 0.45];

  return addOffBallPulse(state, player, channelRunTarget(player, supportTarget, direction), 1);
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
  const tactics = player.teamId === "home" ? state.homeTeam.tactics : state.awayTeam.tactics;
  const tempo = tactics.tempo === "fast" ? 1.12 : tactics.tempo === "slow" ? 0.92 : 1;
  return (BASE_SPEED_PER_TICK + player.baseInput.attributes.agility / 6) * tempo;
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

function supportDepth(player: MutablePlayer): number {
  if (player.baseInput.position === "ST") {
    return 45;
  }
  if (["AM", "LW", "RW"].includes(player.baseInput.position)) {
    return 75;
  }
  if (["CM", "DM"].includes(player.baseInput.position)) {
    return 105;
  }
  return clamp(140, 80, 180);
}

function channelRunTarget(
  player: MutablePlayer,
  target: Coordinate2D,
  direction: 1 | -1
): Coordinate2D {
  if (["LW", "RW", "LB", "RB"].includes(player.baseInput.position)) {
    const touchlineX = player.anchorPosition[0] < PITCH_WIDTH / 2 ? 55 : PITCH_WIDTH - 55;
    return [touchlineX, target[1] + direction * 18];
  }

  if (player.baseInput.position === "ST" || player.baseInput.position === "AM") {
    return [
      target[0] + (player.anchorPosition[0] - PITCH_WIDTH / 2) * 0.18,
      target[1] + direction * 28
    ];
  }

  return target;
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
  const roleMultiplier = ["LW", "RW", "ST", "AM"].includes(player.baseInput.position) ? 1.35 : 0.8;

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
