import { CHANCE_CREATION } from "../calibration/probabilities";
import { emitEvent } from "../ticks/runTick";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { urgencyMultiplier } from "../state/scoreState";
import { staminaEffectMultiplier } from "../state/stamina";
import type { PassType } from "../types";
import { clamp } from "../utils/geometry";
import { zoneForPosition } from "../zones/pitchZones";
import { performShot } from "./actions/shot";
import { shotDistanceContext } from "./shotDistance";

export type ChanceSource =
  | "progressive_pass"
  | "through_ball"
  | "cross"
  | "cutback"
  | "wide_carry"
  | "central_carry";

export function maybeCreateChanceFromPass(
  state: MutableMatchState,
  creator: MutablePlayer,
  receiver: MutablePlayer,
  context: { passType: PassType; progressive: boolean; keyPass: boolean }
): boolean {
  if (!state.dynamics.chanceCreation) {
    return false;
  }

  const source = chanceSourceForPass(context);
  if (!source) {
    return false;
  }

  return maybeCreateChance(state, creator, receiver, source);
}

export function maybeCreateChanceFromCarry(
  state: MutableMatchState,
  carrier: MutablePlayer,
  source: "wide_carry" | "central_carry"
): boolean {
  if (!state.dynamics.chanceCreation) {
    return false;
  }

  return maybeCreateChance(state, carrier, carrier, source);
}

function chanceSourceForPass(context: {
  passType: PassType;
  progressive: boolean;
  keyPass: boolean;
}): ChanceSource | null {
  if (context.passType === "through_ball") {
    return "through_ball";
  }
  if (context.passType === "cross") {
    return "cross";
  }
  if (context.passType === "cutback") {
    return "cutback";
  }
  if (context.progressive || context.keyPass) {
    return "progressive_pass";
  }
  return null;
}

function maybeCreateChance(
  state: MutableMatchState,
  creator: MutablePlayer,
  shooter: MutablePlayer,
  source: ChanceSource
): boolean {
  const zone = zoneForPosition(shooter.teamId, shooter.position);
  if (zone !== "att") {
    return false;
  }

  const shotDistance = shotDistanceContext(shooter.teamId, shooter.position);
  const distanceMultiplier = CHANCE_CREATION.distanceBand[shotDistance.band];
  const pressureMultiplier = CHANCE_CREATION.pressure[state.possession.pressureLevel];
  if (distanceMultiplier <= 0 || pressureMultiplier <= 0) {
    return false;
  }

  const qualityMultiplier = chanceQuality(shooter);
  const urgency = urgencyMultiplier(state, shooter.teamId);
  const urgencyBoost = clamp(
    1 + (urgency - 1) * CHANCE_CREATION.urgencyInfluence,
    CHANCE_CREATION.minUrgencyMultiplier,
    CHANCE_CREATION.maxUrgencyMultiplier
  );
  const probability =
    CHANCE_CREATION.sourceBase[source] *
    pressureMultiplier *
    distanceMultiplier *
    qualityMultiplier *
    urgencyBoost *
    staminaEffectMultiplier(shooter);

  const convertedToShot = state.rng.next() <= probability;
  emitEvent(state, "chance_created", shooter.teamId, shooter.id, {
    creatorPlayerId: creator.id,
    source,
    convertedToShot,
    pressure: state.possession.pressureLevel,
    distanceBand: shotDistance.band,
    urgency: Number(urgency.toFixed(2))
  });

  if (!convertedToShot) {
    return false;
  }

  performShot(state, shooter, { source: "chance_creation", chanceSource: source });
  return true;
}

function chanceQuality(player: MutablePlayer): number {
  if (player.v2Input) {
    const attributes = player.v2Input.attributes;
    return clamp(
      (attributes.finishing * 0.42 + attributes.positioning * 0.33 + attributes.composure * 0.25) /
        75,
      0.55,
      1.28
    );
  }

  const attributes = player.baseInput.attributes;
  return clamp((attributes.shooting * 0.6 + attributes.perception * 0.4) / 75, 0.55, 1.28);
}
