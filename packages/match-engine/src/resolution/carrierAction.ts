import {
  ACTION_WEIGHTS,
  type CarrierAction,
  SCORE_STATE,
  TACTIC_MODIFIERS,
  WIDE_CARRIER_ACTION_MODIFIERS
} from "../calibration/probabilities";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { urgencyMultiplier } from "../state/scoreState";
import { isWideCarrier } from "../utils/playerRoles";
import { performClearance } from "./actions/clearance";
import { performDribble } from "./actions/dribble";
import { performPass } from "./actions/pass";
import { performShot } from "./actions/shot";
import { shotDistanceContext } from "./shotDistance";

export function selectCarrierAction(
  state: MutableMatchState,
  carrier: MutablePlayer
): CarrierAction {
  const zone = state.possession.zone;
  const pressure = state.possession.pressureLevel;
  const weights = { ...ACTION_WEIGHTS[zone][pressure] };
  const tactics = carrier.teamId === "home" ? state.homeTeam.tactics : state.awayTeam.tactics;
  const mentality = TACTIC_MODIFIERS.mentality[tactics.mentality];
  const tempo = TACTIC_MODIFIERS.tempo[tactics.tempo];
  const urgency = urgencyMultiplier(state, carrier.teamId);

  weights.pass *= mentality.pass * tempo.pass * (carrier.baseInput.attributes.passing / 100);
  weights.shoot *=
    mentality.shoot *
    tempo.shoot *
    (carrier.baseInput.attributes.shooting / 100) *
    shotDistanceContext(carrier.teamId, carrier.position).actionWeight;
  weights.dribble *=
    mentality.dribble * tempo.dribble * (carrier.baseInput.attributes.control / 100);
  weights.hold *= mentality.hold * tempo.hold * (carrier.baseInput.attributes.perception / 100);
  weights.clear *= mentality.clear * tempo.clear;
  applyScoreStateWeights(weights, urgency);

  if (isWideCarrier(carrier)) {
    const wideModifiers = WIDE_CARRIER_ACTION_MODIFIERS[zone];
    weights.pass *= wideModifiers.pass;
    weights.shoot *= wideModifiers.shoot;
    weights.dribble *= wideModifiers.dribble;
    weights.hold *= wideModifiers.hold;
    weights.clear *= wideModifiers.clear;
  }

  const total = weights.pass + weights.shoot + weights.dribble + weights.hold + weights.clear;
  if (total <= 0) {
    return "hold";
  }

  let roll = state.rng.next() * total;
  for (const action of ["pass", "shoot", "dribble", "hold", "clear"] as const) {
    roll -= weights[action];
    if (roll <= 0) {
      return action;
    }
  }

  return "hold";
}

function applyScoreStateWeights(weights: Record<CarrierAction, number>, urgency: number): void {
  const delta = urgency - 1;
  for (const action of ["pass", "shoot", "dribble", "hold", "clear"] as const) {
    weights[action] *= Math.max(0.05, 1 + delta * SCORE_STATE.action[action]);
  }
}

export function executeCarrierAction(
  state: MutableMatchState,
  carrier: MutablePlayer,
  action: CarrierAction
): void {
  if (action === "pass") {
    performPass(state, carrier);
  } else if (action === "shoot") {
    performShot(state, carrier);
  } else if (action === "dribble") {
    performDribble(state, carrier);
  } else if (action === "clear") {
    performClearance(state, carrier);
  }
}

export function isVulnerableAction(action: CarrierAction): boolean {
  return action === "pass" || action === "dribble" || action === "hold";
}
