import type { MutableMatchState } from "../state/matchState";
import { PROBABILITIES } from "../calibration/probabilities";
import { performTackle } from "./actions/tackle";
import { createSeededRandom } from "../utils/rng";
import { distSq } from "../utils/geometry";

export function rollPressure(state: MutableMatchState): boolean {
  const carrier = state.players.find(p => p.hasBall);
  if (!carrier) return false;

  const rng = createSeededRandom(state.seed + state.iteration);
  let dispossessed = false;

  // Defenders check
  for (const p of state.players) {
    if (p.teamId === carrier.teamId || !p.onPitch) continue;

    const distStateSq = distSq(p.position, carrier.position);
    if (distStateSq < 90 * 90) { // 9m arbitrary engagement distance
      
      const prob = PROBABILITIES.ACTION_SUCCESS.tackle_attempt_base * (p.baseInput.attributes.tackling / 100);
      if (rng() < prob) {
        // Tackle hits!
        dispossessed = performTackle(state, p, carrier, rng);
        if (dispossessed) {
          break;
        }
      }
    }
  }

  return dispossessed;
}
