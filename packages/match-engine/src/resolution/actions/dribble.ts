import type { MutableMatchState, MutablePlayer } from "../../state/matchState";

export function performDribble(state: MutableMatchState, carrier: MutablePlayer): void {
  // In a dribble, player retains pathing and just holds the ball. 
  // No events emitted, movement logic handles pushing ball forward.
}
