import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { emitEvent } from "../../ticks/runTick";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import { attackDirection } from "../../zones/pitchZones";
import { emitPossessionChange } from "../pressure";

export function performClearance(state: MutableMatchState, carrier: MutablePlayer): void {
  if (state.rng.next() <= SUCCESS_PROBABILITIES.clearanceOutOfPlay) {
    clearOutForThrow(state, carrier);
    return;
  }

  const direction = attackDirection(carrier.teamId);
  const targetY = Math.max(80, Math.min(PITCH_LENGTH - 80, carrier.position[1] + direction * 280));
  const targetX = Math.max(
    35,
    Math.min(PITCH_WIDTH - 35, carrier.position[0] + (state.rng.next() - 0.5) * 260)
  );
  const possibleReceiver = state.players
    .filter(
      (player) => player.teamId === carrier.teamId && player.onPitch && player.id !== carrier.id
    )
    .sort((a, b) => Math.abs(a.position[1] - targetY) - Math.abs(b.position[1] - targetY))[0];

  carrier.hasBall = false;
  if (possibleReceiver && state.rng.next() < 0.42) {
    possibleReceiver.hasBall = true;
    state.ball.carrierPlayerId = possibleReceiver.id;
    state.ball.targetCarrierPlayerId = possibleReceiver.id;
    state.ball.targetPosition = [possibleReceiver.position[0], possibleReceiver.position[1], 0];
  } else {
    state.ball.carrierPlayerId = null;
    state.ball.targetCarrierPlayerId = null;
    state.ball.targetPosition = [targetX, targetY, 0];
  }
  state.ball.inFlight = true;
}

function clearOutForThrow(state: MutableMatchState, carrier: MutablePlayer): void {
  const throwTeam = otherTeam(carrier.teamId);
  const touchlineX = carrier.position[0] < PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH;
  const throwY = Math.max(40, Math.min(PITCH_LENGTH - 40, carrier.position[1]));
  const thrower =
    state.players
      .filter((player) => player.teamId === throwTeam && player.onPitch)
      .sort((a, b) => Math.abs(a.position[1] - throwY) - Math.abs(b.position[1] - throwY))[0] ??
    null;

  carrier.hasBall = false;
  state.ball.position = [touchlineX, throwY, 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;

  if (thrower) {
    thrower.hasBall = true;
    thrower.position = [touchlineX === 0 ? 22 : PITCH_WIDTH - 22, throwY];
    thrower.targetPosition = thrower.position;
    state.ball.carrierPlayerId = thrower.id;
    state.possession.teamId = throwTeam;
    emitEvent(state, "throw_in", throwTeam, thrower.id, {
      wonFrom: carrier.teamId,
      reason: "clearance",
      x: touchlineX,
      y: throwY
    });
    emitPossessionChange(state, carrier.teamId, throwTeam, thrower.id);
  }
}
