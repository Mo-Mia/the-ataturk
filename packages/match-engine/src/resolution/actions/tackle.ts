import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { staminaEffectMultiplier } from "../../state/stamina";
import { emitEvent } from "../../ticks/runTick";
import type { CarrierAction } from "../../calibration/probabilities";
import type { FoulSeverity, TackleType } from "../../types";
import { distanceSquared } from "../../utils/geometry";
import { attackDirection } from "../../zones/pitchZones";
import { awardFreeKick } from "../setPieces";

export type TackleOutcome = "missed" | "won" | "foul";
interface TackleContext {
  carrierAction: CarrierAction;
}

export function resolveTackleAttempt(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer,
  context: TackleContext = { carrierAction: "hold" }
): TackleOutcome {
  const foulProbability =
    SUCCESS_PROBABILITIES.foulOnTackleByPressure[state.possession.pressureLevel];
  if (state.rng.next() <= foulProbability) {
    commitFoul(state, tackler, carrier, context);
    return "foul";
  }

  const successProbability =
    SUCCESS_PROBABILITIES.tackleSuccessBase *
    (tackler.baseInput.attributes.tackling / 100) *
    staminaEffectMultiplier(tackler);
  return state.rng.next() <= successProbability ? "won" : "missed";
}

function commitFoul(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer,
  context: TackleContext
): void {
  state.stats[tackler.teamId].fouls += 1;
  const tackleType = tackleTypeFor(state, tackler, carrier, context);
  const severity = foulSeverityFor(state, tackler, carrier, context, tackleType);
  emitEvent(state, "foul", tackler.teamId, tackler.id, {
    on: carrier.id,
    severity,
    location: state.possession.zone,
    tackleType
  });

  if (state.rng.next() <= SUCCESS_PROBABILITIES.yellowOnFoul) {
    bookPlayer(state, tackler, carrier);
  }

  if (!tackler.redCard && state.rng.next() <= SUCCESS_PROBABILITIES.redOnFoul) {
    sendOff(state, tackler, carrier, "straight_red");
  }

  awardFreeKick(state, carrier.teamId, carrier.id, carrier.position, tackler.id);
}

function tackleTypeFor(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer,
  context: TackleContext
): TackleType {
  const distance = Math.sqrt(distanceSquared(tackler.position, carrier.position));
  return context.carrierAction === "dribble" &&
    (state.possession.pressureLevel !== "low" || distance > 44)
    ? "sliding"
    : "standing";
}

function foulSeverityFor(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer,
  context: TackleContext,
  tackleType: TackleType
): FoulSeverity {
  const direction = attackDirection(carrier.teamId);
  const tacklerBehindCarrier = (tackler.position[1] - carrier.position[1]) * direction < -8;
  if (
    tackleType === "sliding" &&
    (tacklerBehindCarrier || state.possession.pressureLevel === "high")
  ) {
    return "reckless";
  }

  if (
    context.carrierAction === "dribble" &&
    state.possession.zone !== "def" &&
    state.possession.pressureLevel !== "high"
  ) {
    return "cynical";
  }

  return "minor";
}

function bookPlayer(
  state: MutableMatchState,
  tackler: MutablePlayer,
  carrier: MutablePlayer
): void {
  if (tackler.redCard) {
    return;
  }

  state.stats[tackler.teamId].yellowCards += 1;
  tackler.yellowCards += 1;
  emitEvent(state, "yellow", tackler.teamId, tackler.id, {
    on: carrier.id,
    cardCount: tackler.yellowCards
  });

  if (tackler.yellowCards >= 2) {
    sendOff(state, tackler, carrier, "second_yellow");
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
