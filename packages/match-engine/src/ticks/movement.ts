import type { MutableMatchState } from "../state/matchState";
import { moveTowards, distSq } from "../utils/geometry";
import { PITCH_LENGTH } from "../calibration/constants";

const MAX_PLAYER_SPEED_PER_TICK = 25; // meters-ish per 3 sec

export function updateMovement(state: MutableMatchState): void {
  // 1) Ball physics
  if (state.ball.inFlight) {
    // Ball moving towards its designated target. 
    // In our simplified engine, a pass lands immediately the next tick if inFlight.
    state.ball.inFlight = false;
  }

  // 2) Update player targets slightly towards ball if defending,
  // or hold formation if attacking.
  // Extremely rudimentary v0.1 heuristic:
  const ballX = state.ball.position[0];
  const ballY = state.ball.position[1];

  for (const p of state.players) {
    if (!p.onPitch) continue;

    // A carrier runs straight target
    if (p.hasBall) {
      if (p.teamId === "home") {
        p.targetPosition[1] += 15; // Drive forward
      } else {
        p.targetPosition[1] -= 15;
      }
    } else {
      if (state.possession.teamId === p.teamId) {
        // Attacking team pushes up the pitch
        if (p.teamId === "home") {
          p.targetPosition[1] = Math.min(p.targetPosition[1] + 5, PITCH_LENGTH - 100);
        } else {
          p.targetPosition[1] = Math.max(p.targetPosition[1] - 5, 100);
        }
      } else if (state.possession.teamId && state.possession.teamId !== p.teamId) {
        // Defending team moves toward ball if close
        if (distSq(p.position, [ballX, ballY]) < 150 * 150) {
          p.targetPosition = [ballX + (Math.random() * 20 - 10), ballY + (Math.random() * 20 - 10)];
        }
      }
    }
    
    // Bounds check
    p.targetPosition[0] = Math.max(0, Math.min(680, p.targetPosition[0]));
    p.targetPosition[1] = Math.max(0, Math.min(1050, p.targetPosition[1]));

    // 3) Calculate next pos
    p.position = moveTowards(p.position, p.targetPosition, MAX_PLAYER_SPEED_PER_TICK);
  }

  // If carrier, stick ball to them
  const carrier = state.players.find(p => p.hasBall);
  if (carrier) {
    state.ball.position[0] = carrier.position[0];
    state.ball.position[1] = carrier.position[1];
    state.ball.position[2] = 0;
  }
}
