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
export const GOAL_CELEBRATION_TICKS = 4;
export const MAX_PLAYER_DELTA_PER_TICK = 60;

export const CALIBRATION_TARGETS: CalibrationTargets = {
  shotsTarget: [9.7, 15.1],
  goalsTarget: [0.58, 2.17],
  foulsTarget: [8.3, 13.3],
  cardsTarget: [0.915, 2.935],
  maxSingleScoreShare: 0.4
};

export const DETERMINISTIC_GENERATED_AT = "2005-05-25T18:45:00.000Z";
