import type { MatchConfig, TeamStatistics } from "../types";
import { PITCH_WIDTH, PITCH_LENGTH } from "../calibration/constants";
import type { MutableMatchState, MutablePlayer } from "./matchState";
import { positionTeam } from "../utils/formations";

function createEmptyStats(): TeamStatistics {
  return {
    goals: 0,
    shots: { total: 0, on: 0, off: 0, blocked: 0 },
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    corners: 0,
    possession: 50
  };
}

export function buildInitState(config: MatchConfig): MutableMatchState {
  const isSecondHalf = config.duration === "second_half";
  
  const state: MutableMatchState = {
    iteration: 0,
    matchClock: {
      half: isSecondHalf ? 2 : 1,
      minute: isSecondHalf ? 45 : 0,
      seconds: 0
    },
    
    homeTeam: config.homeTeam,
    awayTeam: config.awayTeam,
    duration: config.duration,
    seed: config.seed,

    // Ball starts exact centre
    ball: {
      position: [PITCH_WIDTH / 2, PITCH_LENGTH / 2, 0],
      inFlight: false,
      carrierPlayerId: null
    },

    players: [],

    score: config.preMatchScore ? { ...config.preMatchScore } : { home: 0, away: 0 },

    possession: {
      teamId: null,
      zone: "mid"
    },

    eventsThisTick: [],
    allEvents: [],

    stats: {
      home: config.preMatchStats?.home ? structuredClone(config.preMatchStats.home) : createEmptyStats(),
      away: config.preMatchStats?.away ? structuredClone(config.preMatchStats.away) : createEmptyStats()
    }
  };

  // We place players roughly in their formation later.
  // For init, we put them on the pitch with [0,0] coordinates 
  // and rely on a formation mapper script to arrange them.
  for (const p of config.homeTeam.players) {
    state.players.push({
      id: p.id,
      teamId: "home",
      position: [0, 0],
      targetPosition: [0, 0],
      hasBall: false,
      onPitch: true,
      baseInput: p
    });
  }

  for (const p of config.awayTeam.players) {
    state.players.push({
      id: p.id,
      teamId: "away",
      position: [0, 0],
      targetPosition: [0, 0],
      hasBall: false,
      onPitch: true,
      baseInput: p
    });
  }

  positionTeam(state.players.filter(p => p.teamId === "home"), config.homeTeam.tactics.formation);
  positionTeam(state.players.filter(p => p.teamId === "away"), config.awayTeam.tactics.formation);

  // For the second half, Liverpool kick off. So give ball to home ST initially.
  const homeStriker = state.players.find(p => p.teamId === "home" && p.baseInput.position === "ST");
  if (homeStriker) {
    homeStriker.hasBall = true;
    state.ball.carrierPlayerId = homeStriker.id;
    state.ball.position[0] = homeStriker.position[0];
    state.ball.position[1] = homeStriker.position[1];
    state.possession.teamId = "home";
  }

  return state;
}
