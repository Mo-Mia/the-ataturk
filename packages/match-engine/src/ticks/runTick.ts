import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { SECONDS_PER_TICK } from "../calibration/constants";
import { getPlayerZone } from "../zones/pitchZones";
import { updateMovement } from "./movement";
import { rollPressure } from "../resolution/pressure";
import { rollCarrierAction } from "../resolution/carrierAction";

export function runTick(state: MutableMatchState): void {
  // Clear tick ephemera
  state.eventsThisTick = [];
  
  // 1) Update Clock
  state.iteration += 1;
  const totalSeconds = (state.matchClock.minute * 60) + state.matchClock.seconds + SECONDS_PER_TICK;
  state.matchClock.minute = Math.floor(totalSeconds / 60);
  state.matchClock.seconds = totalSeconds % 60;

  // 2) Update World State (Movement & Physics)
  updateMovement(state);
  
  // 3) Determine Possession & Zone
  updatePossession(state);

  if (state.possession.teamId) {
    // 4) Pressure/Tackle Phase
    const dispossessed = rollPressure(state);
    
    // 5) Carrier Action (if still possessing)
    if (!dispossessed) {
      rollCarrierAction(state);
    }
  }

  // Flush events to match history
  state.allEvents.push(...state.eventsThisTick);
}

// Stubs for the resolution files we will build
function updatePossession(state: MutableMatchState): void {
  let carrier = state.players.find((p) => p.hasBall);

  // If nobody has it and it's not in flight, closest player picks it up
  if (!carrier && !state.ball.inFlight) {
    let closest: MutablePlayer | null = null;
    let closestDistSq = Infinity;
    
    for (const p of state.players) {
      if (!p.onPitch) continue;
      
      const dx = p.position[0] - state.ball.position[0];
      const dy = p.position[1] - state.ball.position[1];
      const distSq = dx*dx + dy*dy;
      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = p;
      }
    }

    if (closest && closestDistSq < 50 * 50) { // arbitrary pickup radius
      closest.hasBall = true;
      carrier = closest;
    }
  }

  if (carrier) {
    state.possession.teamId = carrier.teamId;
    state.possession.zone = getPlayerZone(carrier.position[1], carrier.teamId);
    state.ball.carrierPlayerId = carrier.id;
  } else {
    state.possession.teamId = null;
    state.ball.carrierPlayerId = null;
  }
}


