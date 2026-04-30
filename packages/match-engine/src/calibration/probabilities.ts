import type { PressureLevel, TeamTactics, Zone } from "../types";

export type CarrierAction = "pass" | "shoot" | "dribble" | "hold" | "clear";
export type ShotDistanceBand = "close" | "box" | "edge" | "far" | "speculative";

export const ACTION_WEIGHTS: Record<Zone, Record<PressureLevel, Record<CarrierAction, number>>> = {
  def: {
    low: { pass: 0.55, dribble: 0.04, hold: 0.26, clear: 0.15, shoot: 0 },
    medium: { pass: 0.45, dribble: 0.03, hold: 0.22, clear: 0.3, shoot: 0 },
    high: { pass: 0.34, dribble: 0.02, hold: 0.14, clear: 0.5, shoot: 0 }
  },
  mid: {
    low: { pass: 0.58, dribble: 0.12, hold: 0.28, clear: 0.015, shoot: 0.002 },
    medium: { pass: 0.52, dribble: 0.1, hold: 0.31, clear: 0.05, shoot: 0.006 },
    high: { pass: 0.44, dribble: 0.07, hold: 0.32, clear: 0.13, shoot: 0.012 }
  },
  att: {
    low: { pass: 0.56, dribble: 0.12, hold: 0.25, clear: 0.005, shoot: 0.15 },
    medium: { pass: 0.5, dribble: 0.1, hold: 0.29, clear: 0.01, shoot: 0.22 },
    high: { pass: 0.42, dribble: 0.07, hold: 0.34, clear: 0.02, shoot: 0.32 }
  }
};

export const TACTIC_MODIFIERS = {
  mentality: {
    defensive: { pass: 0.95, shoot: 0.78, dribble: 0.82, hold: 1.1, clear: 1.35 },
    balanced: { pass: 1, shoot: 1, dribble: 1, hold: 1, clear: 1 },
    attacking: { pass: 1.06, shoot: 1.3, dribble: 1.1, hold: 0.85, clear: 0.7 }
  } satisfies Record<TeamTactics["mentality"], Record<CarrierAction, number>>,
  tempo: {
    slow: { pass: 0.95, shoot: 0.85, dribble: 0.85, hold: 1.25, clear: 0.95 },
    normal: { pass: 1, shoot: 1, dribble: 1, hold: 1, clear: 1 },
    fast: { pass: 1.1, shoot: 1.15, dribble: 1.08, hold: 0.72, clear: 1.05 }
  } satisfies Record<TeamTactics["tempo"], Record<CarrierAction, number>>,
  pressing: {
    low: 0.75,
    medium: 1,
    high: 1.3
  } satisfies Record<TeamTactics["pressing"], number>
};

export const SUCCESS_PROBABILITIES = {
  passByZone: { def: 1.02, mid: 0.94, att: 0.86 } satisfies Record<Zone, number>,
  pressureModifier: { low: 1, medium: 0.9, high: 0.78 } satisfies Record<PressureLevel, number>,
  dribbleBase: 0.82,
  dribblePressureModifier: { low: 0.95, medium: 0.75, high: 0.55 } satisfies Record<
    PressureLevel,
    number
  >,
  shotOnTargetByZone: { def: 0, mid: 0.32, att: 0.58 } satisfies Record<Zone, number>,
  shotPressureModifier: { low: 1, medium: 0.86, high: 0.7 } satisfies Record<PressureLevel, number>,
  saveBase: 0.42,
  tackleAttemptByPressure: { low: 0.01, medium: 0.02, high: 0.034 } satisfies Record<
    PressureLevel,
    number
  >,
  tackleSuccessBase: 0.62,
  foulOnTackleByPressure: { low: 0.13, medium: 0.16, high: 0.21 } satisfies Record<
    PressureLevel,
    number
  >,
  yellowOnFoul: 0.25,
  redOnFoul: 0.012,
  failedPassOutOfPlay: 0.055,
  clearanceOutOfPlay: 0.14,
  shotDistance: {
    close: { maxDistanceToGoal: 120, actionWeight: 1.18, onTarget: 1.08, save: 0.62 },
    box: { maxDistanceToGoal: 210, actionWeight: 1.08, onTarget: 1, save: 0.78 },
    edge: { maxDistanceToGoal: 380, actionWeight: 1, onTarget: 0.84, save: 0.96 },
    far: { maxDistanceToGoal: 450, actionWeight: 0.7, onTarget: 0.62, save: 1.12 },
    speculative: { maxDistanceToGoal: Infinity, actionWeight: 0.12, onTarget: 0.2, save: 1.5 }
  } satisfies Record<
    ShotDistanceBand,
    { maxDistanceToGoal: number; actionWeight: number; onTarget: number; save: number }
  >
};
