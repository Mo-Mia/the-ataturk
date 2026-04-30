import type { CalibrationTargets } from "../types";

export const PITCH_WIDTH = 680;
export const PITCH_LENGTH = 1050;
export const GOAL_WIDTH = 90;
export const GOAL_CENTRE_X = PITCH_WIDTH / 2;
export const HOME_GOAL_Y = 0;
export const AWAY_GOAL_Y = PITCH_LENGTH;

export const SECONDS_PER_TICK = 3;
export const TICKS_PER_HALF = 900;
export const TICKS_PER_FULL_MATCH = 1800;

export const CALIBRATION_TARGETS: CalibrationTargets = {
  shotsTarget: [8, 12],
  goalsTarget: [1, 3],
  foulsTarget: [4, 8],
  cardsTarget: [1, 3],
  maxSingleScoreShare: 0.4
};

export const DETERMINISTIC_GENERATED_AT = "2005-05-25T18:45:00.000Z";
