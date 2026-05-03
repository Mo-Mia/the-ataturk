import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import { SET_PIECES, SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { otherTeam, type MutableMatchState, type MutablePlayer } from "../../state/matchState";
import { attackDirection, zoneForPosition } from "../../zones/pitchZones";
import { awardCorner, awardThrowIn } from "../setPieces";

export function performClearance(state: MutableMatchState, carrier: MutablePlayer): void {
  state.pendingLooseBallCause = null;
  state.pendingLooseBallPreviousPossessor = null;

  if (state.rng.next() <= SUCCESS_PROBABILITIES.clearanceOutOfPlay) {
    if (
      state.dynamics.setPieces &&
      zoneForPosition(carrier.teamId, carrier.position) === "def" &&
      state.rng.next() <= SET_PIECES.defensiveClearanceCorner
    ) {
      awardCorner(
        state,
        otherTeam(carrier.teamId),
        carrier.position,
        "defensive_clearance",
        carrier.id
      );
      return;
    }
    awardThrowIn(state, carrier.teamId, carrier.position, "clearance", carrier.id);
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
    state.pendingLooseBallCause = "clearance_recovered";
    state.pendingLooseBallPreviousPossessor = carrier.id;
  }
  state.ball.inFlight = true;
}
