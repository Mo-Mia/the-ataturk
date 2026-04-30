import { AWAY_GOAL_Y, GOAL_CENTRE_X, HOME_GOAL_Y } from "../calibration/constants";
import { SUCCESS_PROBABILITIES, type ShotDistanceBand } from "../calibration/probabilities";
import type { Coordinate2D, TeamId } from "../types";
import { distance } from "../utils/geometry";

export interface ShotDistanceContext {
  band: ShotDistanceBand;
  distanceToGoal: number;
  actionWeight: number;
  onTarget: number;
  save: number;
}

export function shotDistanceContext(teamId: TeamId, position: Coordinate2D): ShotDistanceContext {
  const distanceToGoal = distance(position, attackingGoalCentre(teamId));
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
