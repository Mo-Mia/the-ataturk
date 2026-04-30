import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { emitEvent } from "../../ticks/runTick";

export type TackleOutcome = "missed" | "won" | "foul";

export function resolveTackleAttempt(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer
): TackleOutcome {
  const foulProbability =
    SUCCESS_PROBABILITIES.foulOnTackleByPressure[state.possession.pressureLevel];
  if (state.rng.next() <= foulProbability) {
    commitFoul(state, tackler, carrier);
    return "foul";
  }

  const successProbability =
    SUCCESS_PROBABILITIES.tackleSuccessBase * (tackler.baseInput.attributes.tackling / 100);
  return state.rng.next() <= successProbability ? "won" : "missed";
}

function commitFoul(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer
): void {
  state.stats[tackler.teamId].fouls += 1;
  emitEvent(state, "foul", tackler.teamId, tackler.id, { on: carrier.id });

  if (state.rng.next() <= SUCCESS_PROBABILITIES.yellowOnFoul) {
    state.stats[tackler.teamId].yellowCards += 1;
    tackler.yellowCards += 1;
    emitEvent(state, "yellow", tackler.teamId, tackler.id, { on: carrier.id });

    if (tackler.yellowCards >= 2) {
      sendOff(state, tackler, carrier, "second_yellow");
      return;
    }
  }

  if (state.rng.next() <= SUCCESS_PROBABILITIES.redOnFoul) {
    sendOff(state, tackler, carrier, "straight_red");
  }
}

function sendOff(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer,
  reason: "second_yellow" | "straight_red"
): void {
  if (tackler.redCard) {
    return;
  }

  state.stats[tackler.teamId].redCards += 1;
  tackler.redCard = true;
  tackler.onPitch = false;
  tackler.hasBall = false;
  emitEvent(state, "red", tackler.teamId, tackler.id, { on: carrier.id, reason });
}
