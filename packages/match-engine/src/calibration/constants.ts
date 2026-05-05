import type { CalibrationTargets } from "../types";

/** Width of the simulated pitch coordinate system. */
export const PITCH_WIDTH = 680;
/** Length of the simulated pitch coordinate system. */
export const PITCH_LENGTH = 1050;
/** Goal width in pitch-coordinate units. */
export const GOAL_WIDTH = 90;
/** Horizontal centre of both goals in pitch-coordinate units. */
export const GOAL_CENTRE_X = PITCH_WIDTH / 2;
/** Y-coordinate of the home-defended goal before side switching. */
export const HOME_GOAL_Y = 0;
/** Y-coordinate of the away-defended goal before side switching. */
export const AWAY_GOAL_Y = PITCH_LENGTH;

/** Number of real match seconds represented by each simulation tick. */
export const SECONDS_PER_TICK = 3;
/** Number of ticks in one 45-minute half. */
export const TICKS_PER_HALF = 900;
/** Number of ticks in a full 90-minute match. */
export const TICKS_PER_FULL_MATCH = 1800;
/** Pause length after a goal before the next kick-off event. */
export const GOAL_CELEBRATION_TICKS = 4;
/** Maximum per-tick player movement in pitch-coordinate units. */
export const MAX_PLAYER_DELTA_PER_TICK = 60;

/**
 * Active Phase 14b/17 calibration pass bands.
 *
 * @returns Half-match target bands for characterisation checks; full-90 checks double the
 * values. See `docs/CALIBRATION_BASELINE_PHASE_14.md`.
 */
export const CALIBRATION_TARGETS: CalibrationTargets = {
  shotsTarget: [9.7, 15.1],
  goalsTarget: [0.58, 2.17],
  foulsTarget: [8.3, 13.3],
  cardsTarget: [0.915, 2.935],
  maxSingleScoreShare: 0.4
};

/** Stable timestamp used by deterministic generated match artefacts. */
export const DETERMINISTIC_GENERATED_AT = "2005-05-25T18:45:00.000Z";
