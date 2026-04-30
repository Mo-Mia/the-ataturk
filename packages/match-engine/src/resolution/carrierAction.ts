import type { MutableMatchState } from "../state/matchState";
import { PROBABILITIES } from "../calibration/probabilities";
import { createSeededRandom } from "../utils/rng";
import { performPass } from "./actions/pass";
import { performShot } from "./actions/shot";
import { performDribble } from "./actions/dribble";
import { performClearance } from "./actions/clearance";

export function rollCarrierAction(state: MutableMatchState): void {
  const carrier = state.players.find(p => p.hasBall);
  if (!carrier) return;

  const zone = state.possession.zone;
  const weights = PROBABILITIES.ZONE_ACTION_WEIGHTS[zone];
  const mentality = carrier.teamId === "home" ? state.homeTeam.tactics.mentality : state.awayTeam.tactics.mentality;
  const mods = PROBABILITIES.MENTALITY_MODIFIERS[mentality];

  const passW = weights.pass * mods.pass * (carrier.baseInput.attributes.passing / 100);
  const shootW = weights.shoot * mods.shoot * (carrier.baseInput.attributes.shooting / 100);
  const clearW = weights.clear * mods.clear;
  const holdW = weights.hold * (carrier.baseInput.attributes.control / 100);

  const totalW = passW + shootW + clearW + holdW;
  if (totalW <= 0) {
    performDribble(state, carrier);
    return;
  }

  const rng = createSeededRandom(state.seed + state.iteration + 1); // diff seed offset
  let roll = rng() * totalW;

  if (roll < passW) {
    performPass(state, carrier, rng);
    return;
  }
  roll -= passW;

  if (roll < shootW) {
    performShot(state, carrier, rng);
    return;
  }
  roll -= shootW;

  if (roll < clearW) {
    performClearance(state, carrier, rng);
    return;
  }

  performDribble(state, carrier);
}
