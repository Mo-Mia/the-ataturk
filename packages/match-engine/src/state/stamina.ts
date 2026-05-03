import { MAX_PLAYER_DELTA_PER_TICK } from "../calibration/constants";
import { FATIGUE, type CarrierAction } from "../calibration/probabilities";
import type { MutableMatchState, MutablePlayer } from "./matchState";

export type FatigueAction = CarrierAction | "tackle";

export function applyBaselineFatigue(state: MutableMatchState): void {
  if (!state.dynamics.fatigue) {
    return;
  }

  for (const player of state.players) {
    if (player.onPitch) {
      drainStamina(player, FATIGUE.baselineDrainPerTick);
    }
  }
}

export function applyMovementFatigue(player: MutablePlayer, distanceMoved: number): void {
  const movementRatio = Math.min(1, distanceMoved / MAX_PLAYER_DELTA_PER_TICK);
  drainStamina(player, FATIGUE.movementDrainAtMaxSpeed * movementRatio);
}

export function applyPressingFatigue(player: MutablePlayer): void {
  drainStamina(player, FATIGUE.pressingProximityDrain);
}

export function applyActionFatigue(player: MutablePlayer, action: FatigueAction): void {
  drainStamina(player, FATIGUE.actionDrain[action]);
}

export function staminaEffectMultiplier(player: MutablePlayer): number {
  const stamina = player.stamina;
  const effect = FATIGUE.effect;

  if (stamina >= effect.noPenaltyAbove) {
    return 1;
  }
  if (stamina >= effect.mildFloor) {
    return interpolate(stamina, effect.mildFloor, effect.noPenaltyAbove, effect.mildMultiplier, 1);
  }
  if (stamina >= effect.severeFloor) {
    return interpolate(
      stamina,
      effect.severeFloor,
      effect.mildFloor,
      effect.severeMultiplier,
      effect.mildMultiplier
    );
  }
  return interpolate(
    stamina,
    0,
    effect.severeFloor,
    effect.exhaustedMultiplier,
    effect.severeMultiplier
  );
}

function drainStamina(player: MutablePlayer, rawDrain: number): void {
  player.stamina = Math.max(0, player.stamina - rawDrain * staminaDrainMultiplier(player));
}

function staminaDrainMultiplier(player: MutablePlayer): number {
  const rating = Math.max(1, Math.min(99, player.staminaAttribute));
  if (rating >= 50) {
    return interpolate(
      rating,
      50,
      99,
      FATIGUE.staminaScaling.midAttribute,
      FATIGUE.staminaScaling.highAttribute
    );
  }
  return interpolate(
    rating,
    1,
    50,
    FATIGUE.staminaScaling.lowAttribute,
    FATIGUE.staminaScaling.midAttribute
  );
}

function interpolate(
  value: number,
  min: number,
  max: number,
  minValue: number,
  maxValue: number
): number {
  if (max === min) {
    return maxValue;
  }
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return minValue + (maxValue - minValue) * ratio;
}
