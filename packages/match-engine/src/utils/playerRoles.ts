import { PITCH_WIDTH } from "../calibration/constants";
import type { MutablePlayer } from "../state/matchState";
import type { Position } from "../types";

const WIDE_POSITIONS = new Set<Position>(["LB", "RB", "LM", "RM", "LW", "RW"]);
const WIDE_CHANNEL_EDGE = 190;

export function isWidePosition(position: Position): boolean {
  return WIDE_POSITIONS.has(position);
}

export function isWideChannelX(x: number): boolean {
  return x <= WIDE_CHANNEL_EDGE || x >= PITCH_WIDTH - WIDE_CHANNEL_EDGE;
}

export function isWideCarrier(player: MutablePlayer): boolean {
  return isWidePosition(player.baseInput.position) || isWideChannelX(player.position[0]);
}

export function flankSide(x: number): "left" | "right" {
  return x < PITCH_WIDTH / 2 ? "left" : "right";
}
