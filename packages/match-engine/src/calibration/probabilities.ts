import type { PressureLevel, StarRating, TeamTactics, Zone } from "../types";

export type CarrierAction = "pass" | "shoot" | "dribble" | "hold" | "clear";
export type ShotDistanceBand = "close" | "box" | "edge" | "far" | "speculative";

export const SHOT_PREFERRED_FOOT_PROBABILITY_BY_WEAK_FOOT_RATING: Record<StarRating, number> = {
  1: 0.9,
  2: 0.83,
  3: 0.75,
  4: 0.65,
  5: 0.55
};

export const SHOT_WEAK_FOOT_MULTIPLIER_BY_RATING: Record<StarRating, number> = {
  1: 0.72,
  2: 0.8,
  3: 0.85,
  4: 0.93,
  5: 1
};

export const PASS_TARGET_WEIGHTS = {
  strikerToStrikerPenalty: 16,
  sameFlankWideSupportBonus: 34,
  attackingCrossBonus: 34,
  cutbackBonus: 46,
  postCarryBoxDeliveryBonus: 72,
  postCarryCentralRecyclePenalty: 22,
  postCarryMomentumTicks: 4,
  wideToCentralBouncePenalty: 28
};

export const WIDE_CARRIER_ACTION_MODIFIERS = {
  def: { pass: 0.96, dribble: 1.1, hold: 1.08, clear: 1, shoot: 1 },
  mid: { pass: 0.92, dribble: 1.55, hold: 0.95, clear: 1, shoot: 1 },
  att: { pass: 1.04, dribble: 1.55, hold: 0.72, clear: 1, shoot: 0.98 }
} satisfies Record<Zone, Record<CarrierAction, number>>;

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
    low: { pass: 0.56, dribble: 0.12, hold: 0.25, clear: 0.005, shoot: 0.18 },
    medium: { pass: 0.5, dribble: 0.1, hold: 0.29, clear: 0.01, shoot: 0.26 },
    high: { pass: 0.42, dribble: 0.07, hold: 0.34, clear: 0.02, shoot: 0.38 }
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

export const FATIGUE = {
  baselineDrainPerTick: 0.0286,
  movementDrainAtMaxSpeed: 0.0154,
  pressingProximityDrain: 0.011,
  actionDrain: {
    hold: 0.011,
    pass: 0.0385,
    clear: 0.088,
    dribble: 0.176,
    tackle: 0.198,
    shoot: 0.242
  } satisfies Record<CarrierAction | "tackle", number>,
  staminaScaling: {
    lowAttribute: 1.5,
    midAttribute: 1,
    highAttribute: 0.6
  },
  effect: {
    noPenaltyAbove: 65,
    mildFloor: 35,
    severeFloor: 20,
    mildMultiplier: 0.94,
    severeMultiplier: 0.82,
    exhaustedMultiplier: 0.68
  }
};

export const SUBSTITUTIONS = {
  maxPerTeam: 5,
  aiStartMinute: 62,
  fatigueThreshold: 51,
  cooldownTicks: 160,
  tacticalChaseMinute: 70,
  tacticalDeficit: 2
};

export const SCORE_STATE = {
  minUrgency: 0.7,
  maxUrgency: 1.4,
  levelLateBoost: {
    last30: 0.03,
    last15: 0.08,
    last5: 0.12
  },
  deficitBoost: {
    one: 0.12,
    two: 0.22,
    threePlus: 0.3
  },
  timeFactor: {
    early: 0.25,
    last30: 0.65,
    last15: 1,
    last5: 1.2
  },
  action: {
    pass: 1.04,
    shoot: 1.28,
    dribble: 1.12,
    hold: -0.42,
    clear: -0.2
  } satisfies Record<CarrierAction, number>,
  pressing: 0.45,
  passRisk: 34,
  lateChaseShotIntent: 30
};

export const CHANCE_CREATION = {
  sourceBase: {
    progressive_pass: 0.055,
    through_ball: 0.12,
    cross: 0.1,
    cutback: 0.1,
    wide_carry: 0.075,
    central_carry: 0.09
  },
  pressure: { low: 1, medium: 0.58, high: 0 } satisfies Record<PressureLevel, number>,
  distanceBand: { close: 1.15, box: 1, edge: 0.62, far: 0, speculative: 0 } satisfies Record<
    ShotDistanceBand,
    number
  >,
  urgencyInfluence: 0.9,
  minUrgencyMultiplier: 0.8,
  maxUrgencyMultiplier: 1.35
};

export const SET_PIECES = {
  shotDeflectionCornerByPressure: { low: 0.025, medium: 0.045, high: 0.07 } satisfies Record<
    PressureLevel,
    number
  >,
  defensiveClearanceCorner: 0.46,
  directFreeKickMaxDistance: 330,
  freeKickDirectShotBase: 0.42,
  freeKickCrossBase: 0.62,
  penaltyFromFoulByDistanceBand: {
    close: 1,
    box: 0.75,
    edge: 0.28,
    far: 0,
    speculative: 0
  },
  cornerShotBase: 0.13,
  cornerGoalBase: 0.03,
  directFreeKickGoalBase: 0.065,
  penaltyGoalBase: 0.78
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
  saveBase: 0.405,
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
