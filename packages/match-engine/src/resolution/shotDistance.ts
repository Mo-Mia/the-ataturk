import { AWAY_GOAL_Y, GOAL_CENTRE_X, HOME_GOAL_Y } from "../calibration/constants";
import { SUCCESS_PROBABILITIES, type ShotDistanceBand } from "../calibration/probabilities";
import type { AttackDirection, Coordinate2D, TeamId } from "../types";
import { distance } from "../utils/geometry";
import { attackingGoalY } from "../zones/pitchZones";

export interface ShotDistanceContext {
  band: ShotDistanceBand;
  distanceToGoal: number;
  actionWeight: number;
  onTarget: number;
  save: number;
}

// LEGACY: fixed first-half-throughout perspective for pre-Phase-7 compatibility.
export function shotDistanceContext(teamId: TeamId, position: Coordinate2D): ShotDistanceContext {
  const distanceToGoal = distance(position, attackingGoalCentre(teamId));
  return shotDistanceContextForDistance(distanceToGoal);
}

export function shotDistanceContextForDirection(
  direction: AttackDirection,
  position: Coordinate2D
): ShotDistanceContext {
  const distanceToGoal = distance(position, [GOAL_CENTRE_X, attackingGoalY(direction)]);
  return shotDistanceContextForDistance(distanceToGoal);
}

function shotDistanceContextForDistance(distanceToGoal: number): ShotDistanceContext {
  const band = shotDistanceBand(distanceToGoal);
  const modifiers = SUCCESS_PROBABILITIES.shotDistance[band];
  return {
    band,
    distanceToGoal,
    actionWeight: modifiers.actionWeight,
    onTarget: modifiers.onTarget,
    save: modifiers.save
  };
}

function shotDistanceBand(distanceToGoal: number): ShotDistanceBand {
  const entries = Object.entries(SUCCESS_PROBABILITIES.shotDistance) as Array<
    [ShotDistanceBand, { maxDistanceToGoal: number }]
  >;
  return entries.find(([, modifier]) => distanceToGoal <= modifier.maxDistanceToGoal)?.[0] ?? "far";
}

function attackingGoalCentre(teamId: TeamId): Coordinate2D {
  return [GOAL_CENTRE_X, teamId === "home" ? AWAY_GOAL_Y : HOME_GOAL_Y];
}
