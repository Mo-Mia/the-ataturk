import type { CalibrationTargets } from "../types";

/**
 * Geometry, timing, and active calibration target constants.
 *
 * Phase 14b/17 is the active calibration anchor. The canonical baseline is
 * `docs/CALIBRATION_BASELINE_PHASE_14.md`; provenance detail lives in
 * `docs/CALIBRATION_REFERENCE.md`.
 *
 * Context docs:
 * - `docs/PHASE_13_INVESTIGATION_FINDINGS.md`: event-volume diagnostics.
 * - `docs/PHASE_15_INVESTIGATION_FINDINGS.md`: modulation saturation and score-state authority.
 * - `docs/PHASE_16_INVESTIGATION_FINDINGS.md`: corner-pathway saturation before Phase 17.
 */

/** Purpose: width of the simulated pitch coordinate system. Source: inherited pitch geometry. */
export const PITCH_WIDTH = 680;
/** Purpose: length of the simulated pitch coordinate system. Source: inherited pitch geometry. */
export const PITCH_LENGTH = 1050;
/** Purpose: goal width in pitch-coordinate units. Source: inherited pitch geometry. */
export const GOAL_WIDTH = 90;
/** Purpose: horizontal centre of both goals. Source: derived from inherited pitch width. */
export const GOAL_CENTRE_X = PITCH_WIDTH / 2;
/** Purpose: home-defended goal Y-coordinate before side switching. Source: inherited orientation. */
export const HOME_GOAL_Y = 0;
/** Purpose: away-defended goal Y-coordinate before side switching. Source: inherited orientation. */
export const AWAY_GOAL_Y = PITCH_LENGTH;

/** Purpose: real match seconds represented by one simulation tick. Source: inherited tick model. */
export const SECONDS_PER_TICK = 3;
/** Purpose: number of ticks in one 45-minute half. Source: derived from SECONDS_PER_TICK. */
export const TICKS_PER_HALF = 900;
/** Purpose: number of ticks in a full 90-minute match. Source: derived from SECONDS_PER_TICK. */
export const TICKS_PER_FULL_MATCH = 1800;
/** Purpose: pause length after a goal before the next kick-off. Source: intuitive event pacing. */
export const GOAL_CELEBRATION_TICKS = 4;
/** Purpose: maximum player movement per tick. Source: empirical movement calibration. */
export const MAX_PLAYER_DELTA_PER_TICK = 60;

/**
 * Purpose: active half-match target bands used by characterisation and Phase 14 validation.
 * Source: empirical Phase 14b/17 rebase to one standard deviation of 2025/26 real-PL means
 * (`docs/CALIBRATION_BASELINE_PHASE_14.md`, Policy Changes; `docs/CALIBRATION_REFERENCE_REAL_PL.md`).
 * Full-90 checks double these values. `maxSingleScoreShare` remains an inherited
 * score-distribution guard, not a real-PL volume band.
 *
 * @see docs/CALIBRATION_BASELINE_PHASE_14.md
 */
export const CALIBRATION_TARGETS: CalibrationTargets = {
  /** Purpose: shot-volume pass band; doubles to 19.4-30.2 shots per full match. */
  shotsTarget: [9.7, 15.1],
  /** Purpose: goal-volume pass band; doubles to 1.16-4.34 goals per full match. */
  goalsTarget: [0.58, 2.17],
  /** Purpose: foul-volume pass band; doubles to 16.6-26.6 fouls per full match. */
  foulsTarget: [8.3, 13.3],
  /** Purpose: card-volume pass band; doubles to 1.83-5.87 cards per full match. */
  cardsTarget: [0.915, 2.935],
  /** Purpose: guard against degenerate score distribution concentration. */
  maxSingleScoreShare: 0.4
};

/** Purpose: stable timestamp for deterministic generated artefacts. Source: inherited Istanbul fixture date. */
export const DETERMINISTIC_GENERATED_AT = "2005-05-25T18:45:00.000Z";
