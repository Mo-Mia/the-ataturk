import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { PITCH_LENGTH, PITCH_WIDTH } from "../../calibration/constants";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import { clamp2D } from "../../utils/geometry";
import { attackDirection } from "../../zones/pitchZones";
import { emitPossessionChange } from "../pressure";

export function performDribble(state: MutableMatchState, carrier: MutablePlayer): void {
  const successProbability =
    SUCCESS_PROBABILITIES.dribbleBase *
    SUCCESS_PROBABILITIES.dribblePressureModifier[state.possession.pressureLevel] *
    (carrier.baseInput.attributes.control / 100);

  if (state.rng.next() <= successProbability) {
    const direction = attackDirection(carrier.teamId);
    carrier.position = clamp2D(
      [carrier.position[0] + (state.rng.next() - 0.5) * 34, carrier.position[1] + direction * 34],
      PITCH_WIDTH,
      PITCH_LENGTH
    );
    state.ball.position = [carrier.position[0], carrier.position[1], 0];
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
  emitPossessionChange(state, carrier.teamId, opponent.teamId, opponent.id);
}
