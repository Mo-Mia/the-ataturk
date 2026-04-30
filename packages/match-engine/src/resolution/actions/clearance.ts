import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { PITCH_LENGTH } from "../../calibration/constants";

export function performClearance(state: MutableMatchState, carrier: MutablePlayer, rng: () => number): void {
  carrier.hasBall = false;
  
  // A clearance pushes the ball ~40 meters forward.
  const yDir = carrier.teamId === "home" ? 1 : -1;
  const targetY = state.ball.position[1] + (yDir * 400); // 400 ~ 40m roughly inside 1050 scale
  
  state.ball.position[1] = Math.max(0, Math.min(PITCH_LENGTH, targetY));
  state.possession.teamId = null;
  state.ball.carrierPlayerId = null;
}
