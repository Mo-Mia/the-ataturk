import { ACTION_WEIGHTS, type CarrierAction, TACTIC_MODIFIERS } from "../calibration/probabilities";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { performClearance } from "./actions/clearance";
import { performDribble } from "./actions/dribble";
import { performPass } from "./actions/pass";
import { performShot } from "./actions/shot";

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

  weights.pass *= mentality.pass * tempo.pass * (carrier.baseInput.attributes.passing / 100);
  weights.shoot *= mentality.shoot * tempo.shoot * (carrier.baseInput.attributes.shooting / 100);
  weights.dribble *=
    mentality.dribble * tempo.dribble * (carrier.baseInput.attributes.control / 100);
  weights.hold *= mentality.hold * tempo.hold * (carrier.baseInput.attributes.perception / 100);
  weights.clear *= mentality.clear * tempo.clear;

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
