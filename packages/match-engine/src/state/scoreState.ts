import { SCORE_STATE } from "../calibration/probabilities";
import type { MutableMatchState } from "./matchState";
import type { TeamId } from "../types";

export function urgencyMultiplier(state: MutableMatchState, teamId: TeamId): number {
  if (!state.dynamics.scoreState) {
    return 1;
  }

  const opponent = teamId === "home" ? "away" : "home";
  const differential = state.score[teamId] - state.score[opponent];
  const timeFactor = scoreStateTimeFactor(state);

  if (differential === 0) {
    return clamp(1 + levelBoost(state));
  }

  const magnitude =
    Math.abs(differential) >= 3
      ? SCORE_STATE.deficitBoost.threePlus
      : Math.abs(differential) === 2
        ? SCORE_STATE.deficitBoost.two
        : SCORE_STATE.deficitBoost.one;
  const direction = differential < 0 ? 1 : -1;
  return clamp(1 + direction * magnitude * timeFactor);
}

export function recordScoreStateEvent(state: MutableMatchState): void {
  state.scoreStateEvents.push({
    tick: state.iteration,
    score: { ...state.score },
    urgency: {
      home: urgencyMultiplier(state, "home"),
      away: urgencyMultiplier(state, "away")
    }
  });
}

function scoreStateTimeFactor(state: MutableMatchState): number {
  const remaining = Math.max(0, 90 - state.matchClock.minute);
  if (remaining <= 5) {
    return SCORE_STATE.timeFactor.last5;
  }
  if (remaining <= 15) {
    return SCORE_STATE.timeFactor.last15;
  }
  if (remaining <= 30) {
    return SCORE_STATE.timeFactor.last30;
  }
  return SCORE_STATE.timeFactor.early;
}

function levelBoost(state: MutableMatchState): number {
  const remaining = Math.max(0, 90 - state.matchClock.minute);
  if (remaining <= 5) {
    return SCORE_STATE.levelLateBoost.last5;
  }
  if (remaining <= 15) {
    return SCORE_STATE.levelLateBoost.last15;
  }
  if (remaining <= 30) {
    return SCORE_STATE.levelLateBoost.last30;
  }
  return 0;
}

function clamp(value: number): number {
  return Math.max(SCORE_STATE.minUrgency, Math.min(SCORE_STATE.maxUrgency, value));
}
