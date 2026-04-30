import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { PROBABILITIES } from "../../calibration/probabilities";
import { PITCH_WIDTH, PITCH_LENGTH } from "../../calibration/constants";

export function performTackle(state: MutableMatchState, tackler: MutablePlayer, carrier: MutablePlayer, rng: () => number): boolean {
  // Tackle attempt hit!
  // Does it foul?
  const foulProb = PROBABILITIES.ACTION_SUCCESS.foul_on_tackle_base * (1 - (tackler.baseInput.attributes.tackling / 100));

  if (rng() < foulProb) {
    // Foul
    const tacklerStats = tackler.teamId === "home" ? state.stats.home : state.stats.away;
    tacklerStats.fouls += 1;
    state.eventsThisTick.push({
      type: "foul",
      team: tackler.teamId,
      playerId: tackler.id,
      minute: state.matchClock.minute,
      second: state.matchClock.seconds
    });

    // Check cards
    if (rng() < PROBABILITIES.ACTION_SUCCESS.red_card_base) {
      tacklerStats.redCards += 1;
      tackler.onPitch = false;
      state.eventsThisTick.push({
        type: "red",
        team: tackler.teamId,
        playerId: tackler.id,
        minute: state.matchClock.minute,
        second: state.matchClock.seconds
      });
    } else if (rng() < PROBABILITIES.ACTION_SUCCESS.yellow_card_base) {
      tacklerStats.yellowCards += 1;
      state.eventsThisTick.push({
        type: "yellow",
        team: tackler.teamId,
        playerId: tackler.id,
        minute: state.matchClock.minute,
        second: state.matchClock.seconds
      });
    }

    // Possession stays with carrier (free kick)
    return false; 
  }

  // Clean tackle
  carrier.hasBall = false;
  tackler.hasBall = true;
  state.ball.carrierPlayerId = tackler.id;
  state.possession.teamId = tackler.teamId;
  return true;
}
