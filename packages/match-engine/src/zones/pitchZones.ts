import { PITCH_LENGTH } from "../calibration/constants";
import type { Coordinate2D, TeamId, Zone } from "../types";

export function zoneForPosition(teamId: TeamId, position: Coordinate2D): Zone {
  const y = position[1];

  if (teamId === "home") {
    if (y < PITCH_LENGTH / 3) {
      return "def";
    }
    if (y < (PITCH_LENGTH * 2) / 3) {
      return "mid";
    }
    return "att";
  }

  if (y > (PITCH_LENGTH * 2) / 3) {
    return "def";
  }
  if (y > PITCH_LENGTH / 3) {
    return "mid";
  }
  return "att";
}

export function attackDirection(teamId: TeamId): 1 | -1 {
  return teamId === "home" ? 1 : -1;
}
