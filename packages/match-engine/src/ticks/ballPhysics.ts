import type { MutableMatchState } from "../state/matchState";

export function updateBallPhysics(state: MutableMatchState): void {
  if (!state.ball.inFlight || !state.ball.targetPosition) {
    return;
  }

  state.ball.position = [...state.ball.targetPosition];
  state.ball.inFlight = false;

  if (state.ball.targetCarrierPlayerId) {
    const target = state.players.find((player) => player.id === state.ball.targetCarrierPlayerId);
    if (target?.onPitch) {
      state.players.forEach((player) => {
        player.hasBall = player.id === target.id;
      });
      target.position = [state.ball.position[0], state.ball.position[1]];
      target.targetPosition = [state.ball.position[0], state.ball.position[1]];
      state.ball.carrierPlayerId = target.id;
      state.possession.teamId = target.teamId;
    }
  }

  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
}
