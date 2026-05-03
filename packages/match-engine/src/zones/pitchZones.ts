import { PITCH_LENGTH } from "../calibration/constants";
import type { AttackDirection, Coordinate2D, TeamId, Zone } from "../types";

// LEGACY: fixed first-half-throughout perspective for pre-Phase-7 snapshots and tests.
export function zoneForPosition(teamId: TeamId, position: Coordinate2D): Zone {
  return zoneForPositionWithDirection(position, attackDirection(teamId));
}

export function zoneForPositionWithDirection(
  position: Coordinate2D,
  direction: AttackDirection
): Zone {
  const attackingY = normalisedAttackingY(position[1], direction);
  if (attackingY < PITCH_LENGTH / 3) {
    return "def";
  }
  if (attackingY < (PITCH_LENGTH * 2) / 3) {
    return "mid";
  }
  return "att";
}

export function normalisedAttackingY(y: number, direction: AttackDirection): number {
  return direction === 1 ? y : PITCH_LENGTH - y;
}

// LEGACY: fixed first-half-throughout direction for pre-Phase-7 compatibility.
export function attackDirection(teamId: TeamId): AttackDirection {
  return teamId === "home" ? 1 : -1;
}

export function ownGoalY(direction: AttackDirection): number {
  return direction === 1 ? 0 : PITCH_LENGTH;
}

export function attackingGoalY(direction: AttackDirection): number {
  return direction === 1 ? PITCH_LENGTH : 0;
}
