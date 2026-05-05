import type { PressureLevel, StarRating, TeamTactics, Zone } from "../types";

/**
 * Active calibrated probability and weight tables.
 *
 * Values in this file reflect the Phase 14b/17 active baseline unless a group
 * comment says otherwise. The canonical baseline is
 * `docs/CALIBRATION_BASELINE_PHASE_14.md`; detailed provenance lives in
 * `docs/CALIBRATION_REFERENCE.md`.
 *
 * Context docs:
 * - `docs/PHASE_13_INVESTIGATION_FINDINGS.md`: event-volume diagnostics.
 * - `docs/PHASE_15_INVESTIGATION_FINDINGS.md`: carrier-action saturation and score-state headroom.
 * - `docs/PHASE_16_INVESTIGATION_FINDINGS.md`: corner-pathway saturation before Phase 17.
 */
export type CarrierAction = "pass" | "shoot" | "dribble" | "hold" | "clear";
export type ShotDistanceBand = "close" | "box" | "edge" | "far" | "speculative";

/**
 * Purpose: probability that a shot is taken on a player's preferred foot by weak-foot rating.
 * Source: intuitive v2 bridge shape, checked against the SA weak-foot experiment and carried into
 * Phase 14b/17 baseline (`docs/CALIBRATION_REFERENCE.md`, Weak Foot).
 */
export const SHOT_PREFERRED_FOOT_PROBABILITY_BY_WEAK_FOOT_RATING: Record<StarRating, number> = {
  1: 0.9,
  2: 0.83,
  3: 0.75,
  4: 0.65,
  5: 0.55
};

/**
 * Purpose: power/accuracy penalty applied when a shot uses the weak foot.
 * Source: intuitive v2 bridge shape, checked against the SA weak-foot experiment and carried into
 * Phase 14b/17 baseline (`docs/CALIBRATION_REFERENCE.md`, Weak Foot).
 */
export const SHOT_WEAK_FOOT_MULTIPLIER_BY_RATING: Record<StarRating, number> = {
  1: 0.72,
  2: 0.8,
  3: 0.85,
  4: 0.93,
  5: 1
};

/**
 * Purpose: receiver-selection weights that shape support runs, crossing, cutbacks, and post-carry recycling.
 * Source: empirical UAT Sessions 4-7 wide-delivery work; coverage is implicit through UAT artefacts
 * and responsiveness (`docs/CALIBRATION_REFERENCE.md`, Action Selection).
 */
export const PASS_TARGET_WEIGHTS = {
  /** Purpose: discourages low-value striker-to-striker recycling in central attacks. */
  strikerToStrikerPenalty: 16,
  /** Purpose: rewards same-flank support options for wide carriers. */
  sameFlankWideSupportBonus: 34,
  /** Purpose: boosts attacking-third deliveries into crossing lanes. */
  attackingCrossBonus: 34,
  /** Purpose: favours cutbacks when wide attacks reach dangerous zones. */
  cutbackBonus: 46,
  /** Purpose: keeps post-carry momentum pointed toward box delivery. */
  postCarryBoxDeliveryBonus: 72,
  /** Purpose: penalises immediate central recycling after a carrying action. */
  postCarryCentralRecyclePenalty: 22,
  /** Purpose: duration of the receiver-selection bonus after a carry. */
  postCarryMomentumTicks: 4,
  /** Purpose: dampens unrealistic wide-to-central bounce passing. */
  wideToCentralBouncePenalty: 28
};

/**
 * Purpose: action-selection multipliers for wide ball carriers by pitch zone.
 * Source: empirical UAT Sessions 5-7; values increase midfield/final-third carries without
 * overcorrecting shot volume (`docs/CALIBRATION_REFERENCE.md`, Action Selection).
 */
export const WIDE_CARRIER_ACTION_MODIFIERS = {
  def: { pass: 0.96, dribble: 1.1, hold: 1.08, clear: 1, shoot: 1 },
  mid: { pass: 0.92, dribble: 1.55, hold: 0.95, clear: 1, shoot: 1 },
  att: { pass: 1.04, dribble: 1.55, hold: 0.72, clear: 1, shoot: 0.98 }
} satisfies Record<Zone, Record<CarrierAction, number>>;

/**
 * Purpose: foundational carrier decision matrix by zone and pressure.
 * Source: inherited early engine action mix, adjusted by Phase 14 A5 and Phase 15 alpha. The
 * attacking shoot weights are explicitly part of the Phase 14b/17 lock
 * (`docs/CALIBRATION_BASELINE_PHASE_14.md`, Tune Summary). Phase 15 found that high baseline
 * weights can saturate modulation headroom because carrier actions are normalised by total weight.
 */
export const ACTION_WEIGHTS: Record<Zone, Record<PressureLevel, Record<CarrierAction, number>>> = {
  /** Defensive zone: prioritises clearance as pressure rises; shooting remains unavailable. */
  def: {
    low: { pass: 0.55, dribble: 0.04, hold: 0.26, clear: 0.15, shoot: 0 },
    medium: { pass: 0.45, dribble: 0.03, hold: 0.22, clear: 0.3, shoot: 0 },
    high: { pass: 0.34, dribble: 0.02, hold: 0.14, clear: 0.5, shoot: 0 }
  },
  /** Midfield zone: keeps possession dominant while allowing limited pressure-driven shots. */
  mid: {
    low: { pass: 0.58, dribble: 0.12, hold: 0.28, clear: 0.015, shoot: 0.004 },
    medium: { pass: 0.52, dribble: 0.1, hold: 0.31, clear: 0.05, shoot: 0.012 },
    high: { pass: 0.44, dribble: 0.07, hold: 0.32, clear: 0.13, shoot: 0.024 }
  },
  /** Attacking zone: Phase 14/15-tuned shot weights keep shots/goals in the real-PL band. */
  att: {
    low: { pass: 0.56, dribble: 0.12, hold: 0.25, clear: 0.005, shoot: 0.5508 },
    medium: { pass: 0.5, dribble: 0.1, hold: 0.29, clear: 0.01, shoot: 0.7956 },
    high: { pass: 0.42, dribble: 0.07, hold: 0.34, clear: 0.02, shoot: 1.1628 }
  }
};

/**
 * Purpose: tactical multipliers that expose user-controllable mentality, tempo, and pressing effects.
 * Source: empirical responsiveness testing; Phase 14b/17 baseline preserves all non-diagnostic
 * responsiveness gates (`docs/CALIBRATION_BASELINE_PHASE_14.md`, Responsiveness Lock).
 */
export const TACTIC_MODIFIERS = {
  /** Purpose: shifts action intent between risk reduction and attacking acceleration. */
  mentality: {
    defensive: { pass: 0.95, shoot: 0.78, dribble: 0.82, hold: 1.1, clear: 1.35 },
    balanced: { pass: 1, shoot: 1, dribble: 1, hold: 1, clear: 1 },
    attacking: { pass: 1.06, shoot: 1.3, dribble: 1.1, hold: 0.85, clear: 0.7 }
  } satisfies Record<TeamTactics["mentality"], Record<CarrierAction, number>>,
  /** Purpose: changes possession speed, shot urgency, and holding behaviour. */
  tempo: {
    slow: { pass: 0.95, shoot: 0.85, dribble: 0.85, hold: 1.25, clear: 0.95 },
    normal: { pass: 1, shoot: 1, dribble: 1, hold: 1, clear: 1 },
    fast: { pass: 1.1, shoot: 1.15, dribble: 1.08, hold: 0.72, clear: 1.05 }
  } satisfies Record<TeamTactics["tempo"], Record<CarrierAction, number>>,
  /** Purpose: controls defensive pressure intensity and downstream foul/tackle volume. */
  pressing: {
    low: 0.75,
    medium: 1,
    high: 1.3
  } satisfies Record<TeamTactics["pressing"], number>
};

/**
 * Purpose: stamina drain, stamina-attribute scaling, and low-stamina performance penalties.
 * Source: Phase 5 fatigue calibration, retained through Phase 14b/17 because fatigue impact
 * remains inside the responsiveness lock (`docs/CALIBRATION_REFERENCE.md`, Fatigue).
 */
export const FATIGUE = {
  /** Purpose: continuous per-tick stamina drain independent of movement/action. */
  baselineDrainPerTick: 0.0286,
  /** Purpose: additional drain at maximum movement speed. */
  movementDrainAtMaxSpeed: 0.0154,
  /** Purpose: additional drain for proximity/pressing involvement. */
  pressingProximityDrain: 0.011,
  /** Purpose: action-specific stamina cost, scaled from low-cost holding to high-cost shooting/tackling. */
  actionDrain: {
    hold: 0.011,
    pass: 0.0385,
    clear: 0.088,
    dribble: 0.176,
    tackle: 0.198,
    shoot: 0.242
  } satisfies Record<CarrierAction | "tackle", number>,
  /** Purpose: maps stamina attribute quality onto drain resistance. */
  staminaScaling: {
    lowAttribute: 1.5,
    midAttribute: 1,
    highAttribute: 0.6
  },
  /** Purpose: thresholds and multipliers for performance decay as stamina falls. */
  effect: {
    noPenaltyAbove: 65,
    mildFloor: 35,
    severeFloor: 20,
    mildMultiplier: 0.94,
    severeMultiplier: 0.82,
    exhaustedMultiplier: 0.68
  }
};

/**
 * Purpose: automatic substitution caps, fatigue triggers, spacing, and late tactical triggers.
 * Source: football law for maxPerTeam; intuitive/empirical Phase 5 auto-sub tuning retained by
 * Phase 14b/17 auto-sub responsiveness (`docs/CALIBRATION_REFERENCE.md`, Substitutions).
 */
export const SUBSTITUTIONS = {
  /** Purpose: current football law substitution cap. */
  maxPerTeam: 5,
  /** Purpose: earliest minute at which AI substitutions are considered. */
  aiStartMinute: 62,
  /** Purpose: fatigue threshold that triggers replacement consideration. */
  fatigueThreshold: 51,
  /** Purpose: minimum spacing between AI substitutions in ticks. */
  cooldownTicks: 160,
  /** Purpose: earliest minute for deficit-driven tactical changes. */
  tacticalChaseMinute: 70,
  /** Purpose: deficit size that activates tactical chasing substitutions. */
  tacticalDeficit: 2
};

/**
 * Purpose: urgency model for tied/trailing teams and how urgency changes action intent.
 * Source: intuitive Phase 5 urgency shape, empirical Phase 5/6 deficit tuning, and Phase 15 alpha
 * saturation work. `action.shoot = 1.85` and `lateChaseShotIntent = 42` are explicit Phase 15
 * outcomes in `docs/CALIBRATION_BASELINE_PHASE_14.md`; `maxUrgency` stayed at 1.4 after Phase 15
 * because raising the clamp produced saturation rather than useful authority.
 */
export const SCORE_STATE = {
  /** Purpose: urgency floor prevents leading/low-urgency states from becoming inert. */
  minUrgency: 0.7,
  /** Purpose: urgency ceiling preserves modulation headroom after Phase 15 saturation findings. */
  maxUrgency: 1.4,
  /** Purpose: tied-match late boosts without requiring a deficit. */
  levelLateBoost: {
    last30: 0.03,
    last15: 0.08,
    last5: 0.12
  },
  /** Purpose: extra urgency from one-, two-, and three-goal deficits. */
  deficitBoost: {
    one: 0.12,
    two: 0.22,
    threePlus: 0.3
  },
  /** Purpose: weights urgency more heavily as match time expires. */
  timeFactor: {
    early: 0.25,
    last30: 0.65,
    last15: 1,
    last5: 1.2
  },
  /** Purpose: maps urgency onto carrier actions; Phase 15 specifically tuned shoot authority. */
  action: {
    pass: 1.04,
    shoot: 1.85,
    dribble: 1.12,
    hold: -0.42,
    clear: -0.2
  } satisfies Record<CarrierAction, number>,
  /** Purpose: increases pressing response under urgency. */
  pressing: 0.45,
  /** Purpose: adds direct pass-risk intent under urgency. */
  passRisk: 34,
  /** Purpose: adds late chase shot intent without raising the global urgency clamp. */
  lateChaseShotIntent: 42
};

/**
 * Purpose: chance-creation gates from attacking progression events into shot opportunities.
 * Source: empirical Phase 6, interpreted through Phase 10's context-sensitive finding: ordinary
 * state effect is low, forced late-deficit effect is strongly positive
 * (`docs/CALIBRATION_REFERENCE.md`, Chance Creation).
 */
export const CHANCE_CREATION = {
  /** Purpose: base chance probability by creative source event. */
  sourceBase: {
    progressive_pass: 0.055,
    through_ball: 0.12,
    cross: 0.1,
    cutback: 0.1,
    wide_carry: 0.075,
    central_carry: 0.09
  },
  /** Purpose: pressure gate on whether a progression event can become a shot chance. */
  pressure: { low: 1, medium: 0.58, high: 0 } satisfies Record<PressureLevel, number>,
  /** Purpose: distance gate on whether field position can become a shot chance. */
  distanceBand: { close: 1.15, box: 1, edge: 0.62, far: 0, speculative: 0 } satisfies Record<
    ShotDistanceBand,
    number
  >,
  /** Purpose: how strongly score-state urgency enters chance creation. */
  urgencyInfluence: 0.9,
  /** Purpose: lower clamp for urgency's chance-creation multiplier. */
  minUrgencyMultiplier: 0.8,
  /** Purpose: upper clamp for urgency's chance-creation multiplier. */
  maxUrgencyMultiplier: 1.35
};

/**
 * Purpose: set-piece creation and conversion probabilities.
 * Source: Phase 6 set-piece conversion, Phase 14b/17 corner tuning, Phase 16 saturation diagnosis,
 * and Phase 17 save/parry-wide plus blocked-delivery pathways (`docs/CALIBRATION_REFERENCE.md`,
 * Set Pieces; `docs/PHASE_16_INVESTIGATION_FINDINGS.md`).
 */
export const SET_PIECES = {
  /** Purpose: corners from blocked/deflected missed shots; empirical Phase 14b/17. */
  shotDeflectionCornerByPressure: { low: 0.0625, medium: 0.1125, high: 0.175 } satisfies Record<
    PressureLevel,
    number
  >,
  /** Purpose: corners from defensive clearances; Phase 16 notes this pathway saturates at 1.0. */
  defensiveClearanceCorner: 0.92,
  /** Purpose: saved/parried shots directed wide for corners; empirical Phase 17 pathway. */
  saveCornerByPressure: { low: 0.16, medium: 0.24, high: 0.32 } satisfies Record<
    PressureLevel,
    number
  >,
  /** Purpose: failed attacking-third crosses/cutbacks blocked behind; empirical Phase 17 pathway. */
  blockedDeliveryCornerByPressure: { low: 0.18, medium: 0.27, high: 0.36 } satisfies Record<
    PressureLevel,
    number
  >,
  /** Purpose: maximum foul distance where direct free-kick shots remain available. */
  directFreeKickMaxDistance: 330,
  /** Purpose: base choice weight for direct free-kick shots. */
  freeKickDirectShotBase: 0.42,
  /** Purpose: base choice weight for crossed free kicks. */
  freeKickCrossBase: 0.62,
  /** Purpose: probability that attacking fouls by distance band become penalties. */
  penaltyFromFoulByDistanceBand: {
    close: 1,
    box: 0.75,
    edge: 0.28,
    far: 0,
    speculative: 0
  },
  /** Purpose: base probability that a corner produces a shot. */
  cornerShotBase: 0.13,
  /** Purpose: base probability that a corner shot produces a goal. */
  cornerGoalBase: 0.03,
  /** Purpose: base direct free-kick conversion probability. */
  directFreeKickGoalBase: 0.065,
  /** Purpose: base penalty conversion probability. */
  penaltyGoalBase: 0.78
};

/**
 * Purpose: action-success probabilities for passes, dribbles, shots, saves, tackles, fouls, cards,
 * out-of-play events, and shot distance quality.
 * Source: mixed inherited, Phase 6, Phase 14 A5, Phase 14b B1, and Phase 15 alpha values, with
 * active event-volume lock in `docs/CALIBRATION_BASELINE_PHASE_14.md`.
 */
export const SUCCESS_PROBABILITIES = {
  /** Purpose: zone-specific pass completion centre points; inherited and implicitly covered. */
  passByZone: { def: 1.02, mid: 0.94, att: 0.86 } satisfies Record<Zone, number>,
  /** Purpose: pressure effect on pass completion; inherited and covered through pressing response. */
  pressureModifier: { low: 1, medium: 0.9, high: 0.78 } satisfies Record<PressureLevel, number>,
  /** Purpose: base dribble success before pressure and player-quality effects. */
  dribbleBase: 0.82,
  /** Purpose: pressure effect on dribble success. */
  dribblePressureModifier: { low: 0.95, medium: 0.75, high: 0.55 } satisfies Record<
    PressureLevel,
    number
  >,
  /** Purpose: shot-on-target chance by zone; Phase 14 A5 / Phase 15 alpha. */
  shotOnTargetByZone: { def: 0, mid: 0.224, att: 0.406 } satisfies Record<Zone, number>,
  /** Purpose: pressure effect on shot accuracy. */
  shotPressureModifier: { low: 1, medium: 0.86, high: 0.7 } satisfies Record<PressureLevel, number>,
  /** Purpose: goalkeeper save centre point; Phase 14 A5 / Phase 15 alpha. */
  saveBase: 0.50625,
  /** Purpose: tackle event frequency by pressing pressure; Phase 14b B1 foul/card economy. */
  tackleAttemptByPressure: { low: 0.03, medium: 0.06, high: 0.102 } satisfies Record<
    PressureLevel,
    number
  >,
  /** Purpose: base tackle success before player-quality effects. */
  tackleSuccessBase: 0.62,
  /** Purpose: foul frequency from tackle attempts; Phase 14b B1 foul/card economy. */
  foulOnTackleByPressure: { low: 0.195, medium: 0.24, high: 0.315 } satisfies Record<
    PressureLevel,
    number
  >,
  /** Purpose: yellow-card probability after a foul; empirical discipline tuning. */
  yellowOnFoul: 0.25,
  /** Purpose: red-card probability after a foul; empirical discipline tuning. */
  redOnFoul: 0.012,
  /** Purpose: failed-pass restart volume contribution; empirical Phase 6. */
  failedPassOutOfPlay: 0.055,
  /** Purpose: clearance restart volume contribution; empirical Phase 6. */
  clearanceOutOfPlay: 0.14,
  /** Purpose: distance-band thresholds and multipliers for shot intent, accuracy, and save difficulty. */
  shotDistance: {
    /** Purpose: highest-quality close-range shots. */
    close: { maxDistanceToGoal: 120, actionWeight: 1.18, onTarget: 1.08, save: 0.62 },
    /** Purpose: normal box shots used as the central quality band. */
    box: { maxDistanceToGoal: 210, actionWeight: 1.08, onTarget: 1, save: 0.78 },
    /** Purpose: edge-of-box shots with lower accuracy and tougher conversion. */
    edge: { maxDistanceToGoal: 380, actionWeight: 1, onTarget: 0.84, save: 0.96 },
    /** Purpose: long shots with reduced intent and accuracy. */
    far: { maxDistanceToGoal: 450, actionWeight: 0.7, onTarget: 0.62, save: 1.12 },
    /** Purpose: speculative shots; Phase 14 A5 reduced the action weight to protect shot quality. */
    speculative: { maxDistanceToGoal: Infinity, actionWeight: 0.1968, onTarget: 0.2, save: 1.5 }
  } satisfies Record<
    ShotDistanceBand,
    { maxDistanceToGoal: number; actionWeight: number; onTarget: number; save: number }
  >
};
