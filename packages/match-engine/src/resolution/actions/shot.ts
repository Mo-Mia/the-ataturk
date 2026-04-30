import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { PROBABILITIES } from "../../calibration/probabilities";

export function performShot(state: MutableMatchState, carrier: MutablePlayer, rng: () => number): void {
  const teamStats = carrier.teamId === "home" ? state.stats.home : state.stats.away;
  teamStats.shots.total += 1;

  state.eventsThisTick.push({
    type: "shot",
    team: carrier.teamId,
    playerId: carrier.id,
    minute: state.matchClock.minute,
    second: state.matchClock.seconds,
    detail: { result: "attempted" }
  });

  const onTargetProb = PROBABILITIES.ACTION_SUCCESS.shot_on_target_base * (carrier.baseInput.attributes.shooting / 100);

  carrier.hasBall = false; // ball leaves foot
  state.ball.carrierPlayerId = null;

  if (rng() < onTargetProb) {
    teamStats.shots.on += 1;
    // Resolve Save vs Goal
    const oppTeam = carrier.teamId === "home" ? "away" : "home";
    const gk = state.players.find(p => p.teamId === oppTeam && p.baseInput.position === "GK");
    
    // Convert logic
    const shotPower = rng() + (carrier.baseInput.attributes.shooting / 100) + (carrier.baseInput.attributes.perception / 100);
    const savePower = gk ? rng() + (gk.baseInput.attributes.saving / 100) + (gk.baseInput.attributes.agility / 100) : rng();
    
    // Scale shotPower up slightly to favor goals if shots are rare. Will calibrate this later.
    if (shotPower > savePower) {
      // Goal
      teamStats.goals += 1;
      state.score[carrier.teamId] += 1;
      state.eventsThisTick.push({
        type: "goal",
        team: carrier.teamId,
        playerId: carrier.id,
        minute: state.matchClock.minute,
        second: state.matchClock.seconds
      });
      // Match stops, reset to center next tick via kick_off or just set pos
      state.ball.position = [340, 525, 0];
      state.possession.teamId = oppTeam;
      // Kick off to opponent ST
      const oppSt = state.players.find(p => p.teamId === oppTeam && p.baseInput.position === "ST");
      if (oppSt) oppSt.hasBall = true;
    } else {
      // Save
      const oppStats = carrier.teamId === "home" ? state.stats.away : state.stats.home;
      if (gk) {
        state.eventsThisTick.push({
          type: "save",
          team: oppTeam,
          playerId: gk.id,
          minute: state.matchClock.minute,
          second: state.matchClock.seconds
        });
        gk.hasBall = true;
        state.ball.carrierPlayerId = gk.id;
        state.possession.teamId = oppTeam;
      }
    }
  } else {
    teamStats.shots.off += 1;
    // Goal kick
    const oppTeam = carrier.teamId === "home" ? "away" : "home";
    const gk = state.players.find(p => p.teamId === oppTeam && p.baseInput.position === "GK");
    if (gk) {
      gk.hasBall = true;
      state.ball.carrierPlayerId = gk.id;
    }
    state.possession.teamId = oppTeam;
  }
}
