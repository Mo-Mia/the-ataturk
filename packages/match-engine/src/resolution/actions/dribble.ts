import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { staminaEffectMultiplier } from "../../state/stamina";
import { otherTeam } from "../../state/matchState";
import { emitEvent } from "../../ticks/runTick";
import { clamp2D } from "../../utils/geometry";
import { flankSide, isWideCarrier } from "../../utils/playerRoles";
import { zoneForPositionWithDirection } from "../../zones/pitchZones";
import { maybeCreateChanceFromCarry } from "../chanceCreation";
import { emitPossessionChange } from "../pressure";

export function performDribble(state: MutableMatchState, carrier: MutablePlayer): void {
  const successProbability =
    SUCCESS_PROBABILITIES.dribbleBase *
    SUCCESS_PROBABILITIES.dribblePressureModifier[state.possession.pressureLevel] *
    (carrier.baseInput.attributes.control / 100) *
    staminaEffectMultiplier(carrier);

  if (state.rng.next() <= successProbability) {
    const direction = state.attackDirection[carrier.teamId];
    const previousPosition = carrier.position;
    const nextPosition: [number, number] = isWideCarrier(carrier)
      ? wideDribbleTarget(state, carrier, direction)
      : [carrier.position[0] + (state.rng.next() - 0.5) * 34, carrier.position[1] + direction * 34];
    carrier.position = clamp2D(nextPosition, PITCH_WIDTH, PITCH_LENGTH);
    state.ball.position = [carrier.position[0], carrier.position[1], 0];
    if (isWideCarrier(carrier)) {
      carrier.lastWideCarryTick = state.iteration;
      emitWideCarryEvent(state, carrier, direction, previousPosition);
      maybeCreateChanceFromCarry(state, carrier, "wide_carry");
    } else if (zoneForState(state, carrier.teamId, carrier.position) === "att") {
      maybeCreateChanceFromCarry(state, carrier, "central_carry");
    }
    return;
  }

  const opponent = state.players
    .filter((player) => player.teamId === otherTeam(carrier.teamId) && player.onPitch)
    .sort(
      (a, b) =>
        Math.abs(a.position[0] - carrier.position[0]) +
        Math.abs(a.position[1] - carrier.position[1]) -
        (Math.abs(b.position[0] - carrier.position[0]) +
          Math.abs(b.position[1] - carrier.position[1]))
    )[0];

  if (!opponent) {
    return;
  }

  carrier.hasBall = false;
  opponent.hasBall = true;
  state.ball.carrierPlayerId = opponent.id;
  state.ball.position = [opponent.position[0], opponent.position[1], 0];
  state.possession.teamId = opponent.teamId;
  emitPossessionChange(state, carrier.teamId, opponent.teamId, opponent.id, {
    cause: "failed_dribble",
    previousPossessor: carrier.id,
    zone: zoneForState(state, opponent.teamId, opponent.position)
  });
}

function emitWideCarryEvent(
  state: MutableMatchState,
  carrier: MutablePlayer,
  direction: 1 | -1,
  previousPosition: [number, number]
): void {
  const progress = (carrier.position[1] - previousPosition[1]) * direction;
  const zone = zoneForState(state, carrier.teamId, carrier.position);
  if (zone !== "att" && progress < 28) {
    return;
  }

  emitEvent(state, "carry", carrier.teamId, carrier.id, {
    carryType: zone === "att" ? "flank_drive" : "wide_progression",
    progressive: progress >= 28,
    zone,
    flank: flankSide(carrier.position[0])
  });
}

function wideDribbleTarget(
  state: MutableMatchState,
  carrier: MutablePlayer,
  direction: 1 | -1
): [number, number] {
  const side = flankSide(carrier.position[0]);
  const channelX = side === "left" ? 72 : PITCH_WIDTH - 72;
  const channelPull = (channelX - carrier.position[0]) * 0.42;
  const insideJitter = (state.rng.next() - 0.5) * 18;
  const forwardCarry = direction * 44;

  return [carrier.position[0] + channelPull + insideJitter, carrier.position[1] + forwardCarry];
}

function zoneForState(
  state: MutableMatchState,
  teamId: MutablePlayer["teamId"],
  position: MutablePlayer["position"]
) {
  return zoneForPositionWithDirection(position, state.attackDirection[teamId]);
}
