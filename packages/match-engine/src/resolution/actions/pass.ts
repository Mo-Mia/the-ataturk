import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { PROBABILITIES } from "../../calibration/probabilities";

export function performPass(state: MutableMatchState, carrier: MutablePlayer, rng: () => number): void {
  const prob = PROBABILITIES.ACTION_SUCCESS.pass_base * (carrier.baseInput.attributes.passing / 100);
  
  if (rng() < prob) {
    // Pass succeeds. Pick a target teammate.
    let teammates = state.players.filter(p => p.teamId === carrier.teamId && p.id !== carrier.id && p.onPitch);
    if (teammates.length > 0) {
      const yDir = carrier.teamId === "home" ? 1 : -1;
      const forwardTeammates = teammates.filter(t => (t.position[1] - carrier.position[1]) * yDir > -20);
      if (forwardTeammates.length > 0) {
        teammates = forwardTeammates;
      }
      const target = teammates[Math.floor(rng() * teammates.length)]!;
      // For v0.1, we immediately transfer the ball if short pass, or mark inFlight for 1 tick if long.
      // Easiest is just set target target.targetPosition = target.position, and teleport ball slightly.
      state.ball.position[0] = target.position[0];
      state.ball.position[1] = target.position[1];
      carrier.hasBall = false;
      target.hasBall = true;
      state.ball.carrierPlayerId = target.id;
    }
  } else {
    // Pass fails. Turn over possession.
    const opponents = state.players.filter(p => p.teamId !== carrier.teamId && p.onPitch);
    if (opponents.length > 0) {
      const target = opponents[Math.floor(rng() * opponents.length)]!;
      carrier.hasBall = false;
      target.hasBall = true;
      state.ball.carrierPlayerId = target.id;
      state.possession.teamId = target.teamId;
      state.eventsThisTick.push({
        type: "possession_change",
        team: carrier.teamId,
        playerId: carrier.id,
        minute: state.matchClock.minute,
        second: state.matchClock.seconds
      });
    }
  }
}
