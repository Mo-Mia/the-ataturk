import type { PressureLevel } from "@the-ataturk/match-engine";
import type { CarrierAction } from "../../../match-engine/src/calibration/probabilities";

type ActionWeights = Record<CarrierAction, number>;

export interface Phase15ActionConfig {
  id: "phase8" | "a5" | "alpha";
  label: string;
  attMedium: ActionWeights;
  midMedium: ActionWeights;
  scoreStateShoot: number;
  lateChaseShotIntent: number;
}

export interface ActionProbabilityRow {
  config: Phase15ActionConfig["id"];
  zone: "att" | "mid";
  scenario: string;
  urgency: number;
  shotProbability: number;
  passProbability: number;
  dribbleProbability: number;
  holdProbability: number;
  clearProbability: number;
}

export interface HeadroomRow {
  mechanism: "shoot" | "pass" | "dribble" | "tackle";
  config: Phase15ActionConfig["id"];
  minProbability: number;
  maxProbability: number;
  headroom: number;
  note: string;
}

export interface Phase15DiagnosticsReport {
  configs: Phase15ActionConfig[];
  actionProbabilities: ActionProbabilityRow[];
  headroom: HeadroomRow[];
  synthesis: {
    saturationMechanism: string;
    alphaJustification: string;
    generalityFinding: string;
  };
}

const ATTRIBUTE_AVERAGE = 0.85;
const TIED_FINAL_15_URGENCY = 1.08;
const TRAILING_TWO_FINAL_15_URGENCY = 1.22;

const SCORE_STATE_ACTION_BASE: Record<CarrierAction, number> = {
  pass: 1.04,
  shoot: 1.28,
  dribble: 1.12,
  hold: -0.42,
  clear: -0.2
};

export const PHASE15_CONFIGS: Phase15ActionConfig[] = [
  {
    id: "phase8",
    label: "Phase 8 / pre-Phase-14 shoot baseline",
    attMedium: { pass: 0.5, dribble: 0.1, hold: 0.29, clear: 0.01, shoot: 0.26 },
    midMedium: { pass: 0.52, dribble: 0.1, hold: 0.31, clear: 0.05, shoot: 0.006 },
    scoreStateShoot: 1.28,
    lateChaseShotIntent: 30
  },
  {
    id: "a5",
    label: "Phase 14 A5 paused configuration",
    attMedium: { pass: 0.5, dribble: 0.1, hold: 0.29, clear: 0.01, shoot: 0.936 },
    midMedium: { pass: 0.52, dribble: 0.1, hold: 0.31, clear: 0.05, shoot: 0.012 },
    scoreStateShoot: 1.28,
    lateChaseShotIntent: 30
  },
  {
    id: "alpha",
    label: "Phase 15 alpha: 85% A5 att-zone baseline with stronger score-state modulation",
    attMedium: { pass: 0.5, dribble: 0.1, hold: 0.29, clear: 0.01, shoot: 0.7956 },
    midMedium: { pass: 0.52, dribble: 0.1, hold: 0.31, clear: 0.05, shoot: 0.012 },
    scoreStateShoot: 1.85,
    lateChaseShotIntent: 42
  }
];

export function runPhase15ModulationDiagnostics(): Phase15DiagnosticsReport {
  const actionProbabilities = PHASE15_CONFIGS.flatMap((config) => [
    probabilityRow(config, "att", "tied final-15", TIED_FINAL_15_URGENCY),
    probabilityRow(config, "att", "trailing 0-2 final-15", TRAILING_TWO_FINAL_15_URGENCY),
    probabilityRow(config, "mid", "tied final-15", TIED_FINAL_15_URGENCY),
    probabilityRow(config, "mid", "trailing 0-2 final-15", TRAILING_TWO_FINAL_15_URGENCY)
  ]);
  return {
    configs: PHASE15_CONFIGS,
    actionProbabilities,
    headroom: PHASE15_CONFIGS.flatMap((config) => [
      shootHeadroom(config),
      passHeadroom(config),
      dribbleHeadroom(config),
      tackleHeadroom(config)
    ]),
    synthesis: {
      saturationMechanism:
        "Carrier actions are sampled from post-modulation weights via actionWeight / totalWeight; higher baseline shoot weight consumes more of the normalised action budget, so urgency multipliers produce less relative shot uplift.",
      alphaJustification:
        "Alpha cuts A5 attacking-zone shoot baseline to 85% while increasing score-state shoot influence from 1.28 to 1.85 and late-chase intent from 30 to 42; static headroom recovers most of the Phase 8 trailing-vs-tied shot-probability range without returning to Phase 8's low shot supply.",
      generalityFinding:
        "The saturation concern applies to sum-normalised carrier actions such as shoot, pass and dribble. Tackle attempts use direct probability multiplication by pressing, urgency, tackling and stamina, so Phase 14b foul tuning faces a simpler non-normalised calibration path."
    }
  };
}

function probabilityRow(
  config: Phase15ActionConfig,
  zone: "att" | "mid",
  scenario: string,
  urgency: number
): ActionProbabilityRow {
  const probabilities = actionProbabilities(config, zone, urgency);
  return {
    config: config.id,
    zone,
    scenario,
    urgency,
    shotProbability: probabilities.shoot,
    passProbability: probabilities.pass,
    dribbleProbability: probabilities.dribble,
    holdProbability: probabilities.hold,
    clearProbability: probabilities.clear
  };
}

function shootHeadroom(config: Phase15ActionConfig): HeadroomRow {
  const minProbability = actionProbabilities(config, "att", TIED_FINAL_15_URGENCY).shoot;
  const maxProbability = actionProbabilities(config, "att", TRAILING_TWO_FINAL_15_URGENCY).shoot;
  return {
    mechanism: "shoot",
    config: config.id,
    minProbability,
    maxProbability,
    headroom: maxProbability - minProbability,
    note: "Attacking-zone medium-pressure carrier, tied final-15 vs trailing 0-2 final-15."
  };
}

function passHeadroom(config: Phase15ActionConfig): HeadroomRow {
  const slow = actionProbabilities(config, "mid", 1, { tempoPass: 0.95, tempoShoot: 0.85 }).pass;
  const fast = actionProbabilities(config, "mid", 1, { tempoPass: 1.1, tempoShoot: 1.15 }).pass;
  return {
    mechanism: "pass",
    config: config.id,
    minProbability: Math.min(slow, fast),
    maxProbability: Math.max(slow, fast),
    headroom: Math.abs(fast - slow),
    note: "Middle-zone medium-pressure carrier, slow tempo vs fast tempo pass probability."
  };
}

function dribbleHeadroom(config: Phase15ActionConfig): HeadroomRow {
  const defensive = actionProbabilities(config, "att", 1, {
    mentalityShoot: 0.78,
    mentalityDribble: 0.82
  }).dribble;
  const attacking = actionProbabilities(config, "att", 1, {
    mentalityShoot: 1.3,
    mentalityDribble: 1.1
  }).dribble;
  return {
    mechanism: "dribble",
    config: config.id,
    minProbability: Math.min(defensive, attacking),
    maxProbability: Math.max(defensive, attacking),
    headroom: Math.abs(attacking - defensive),
    note: "Attacking-zone medium-pressure carrier, defensive mentality vs attacking mentality dribble probability."
  };
}

function tackleHeadroom(config: Phase15ActionConfig): HeadroomRow {
  const lowPress = tackleAttemptProbability("medium", 0.75, 1);
  const highPress = tackleAttemptProbability("medium", 1.3, TRAILING_TWO_FINAL_15_URGENCY);
  return {
    mechanism: "tackle",
    config: config.id,
    minProbability: lowPress,
    maxProbability: highPress,
    headroom: highPress - lowPress,
    note: "Medium-pressure tackler, low pressing at urgency 1.0 vs high pressing while trailing at urgency 1.22; independent of carrier-action baselines."
  };
}

function actionProbabilities(
  config: Phase15ActionConfig,
  zone: "att" | "mid",
  urgency: number,
  overrides: {
    mentalityShoot?: number;
    mentalityDribble?: number;
    tempoPass?: number;
    tempoShoot?: number;
  } = {}
): Record<CarrierAction, number> {
  const base = zone === "att" ? config.attMedium : config.midMedium;
  const weights = { ...base };
  weights.pass *= ATTRIBUTE_AVERAGE * (overrides.tempoPass ?? 1);
  weights.shoot *=
    ATTRIBUTE_AVERAGE *
    (overrides.mentalityShoot ?? 1) *
    (overrides.tempoShoot ?? 1);
  weights.dribble *= ATTRIBUTE_AVERAGE * (overrides.mentalityDribble ?? 1);
  weights.hold *= ATTRIBUTE_AVERAGE;

  const delta = urgency - 1;
  weights.pass *= Math.max(0.05, 1 + delta * SCORE_STATE_ACTION_BASE.pass);
  weights.shoot *= Math.max(0.05, 1 + delta * config.scoreStateShoot);
  weights.dribble *= Math.max(0.05, 1 + delta * SCORE_STATE_ACTION_BASE.dribble);
  weights.hold *= Math.max(0.05, 1 + delta * SCORE_STATE_ACTION_BASE.hold);
  weights.clear *= Math.max(0.05, 1 + delta * SCORE_STATE_ACTION_BASE.clear);

  if (zone === "att" && urgency > 1.12) {
    weights.shoot *= 1 + delta * config.lateChaseShotIntent;
  }

  const total = weights.pass + weights.shoot + weights.dribble + weights.hold + weights.clear;
  return {
    pass: weights.pass / total,
    shoot: weights.shoot / total,
    dribble: weights.dribble / total,
    hold: weights.hold / total,
    clear: weights.clear / total
  };
}

function tackleAttemptProbability(
  pressure: PressureLevel,
  pressingModifier: number,
  urgency: number
): number {
  const baseByPressure = { low: 0.01, medium: 0.02, high: 0.034 } satisfies Record<
    PressureLevel,
    number
  >;
  const urgencyFactor = Math.max(0.2, 1 + (urgency - 1) * 0.45);
  return baseByPressure[pressure] * pressingModifier * urgencyFactor * ATTRIBUTE_AVERAGE;
}
