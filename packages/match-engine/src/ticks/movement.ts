import { PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
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
    target = supportingTarget(player, target, carrier, direction);
  } else if (
    teamInPossession &&
    distanceSquared(player.position, ballPosition) < BALL_PRESS_DISTANCE ** 2
  ) {
    target = defensiveTarget(player, ballPosition, tactics.pressing);
  }

  return clamp2D(target, PITCH_WIDTH, PITCH_LENGTH);
}

function supportingTarget(
  player: MutablePlayer,
  anchorTarget: Coordinate2D,
  carrier: MutablePlayer | null,
  direction: 1 | -1
): Coordinate2D {
  if (!carrier) {
    return anchorTarget;
  }

  const supportY = carrier.position[1] - direction * supportDepth(player);
  const supportX = anchorTarget[0] + (carrier.position[0] - PITCH_WIDTH / 2) * 0.12;
  return [supportX, anchorTarget[1] * 0.55 + supportY * 0.45];
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
