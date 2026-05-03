import { PITCH_LENGTH } from "../calibration/constants";
import type { MutableMatchState } from "./matchState";
import type { AttackDirection, PassType, SemanticEvent, TeamId } from "../types";

const MAX_MOMENTUM = 100;
const POSSESSION_DECAY = 0.97;
const OUT_OF_POSSESSION_DECAY = 0.88;
const TURNOVER_RETAINED_MOMENTUM = 0.35;

export function updateAttackMomentum(state: MutableMatchState): void {
  const teamInPossession = state.possession.teamId;
  updatePossessionStreak(state, teamInPossession);

  if (!teamInPossession) {
    decayTeam(state, "home", OUT_OF_POSSESSION_DECAY);
    decayTeam(state, "away", OUT_OF_POSSESSION_DECAY);
    return;
  }

  const otherTeam = teamInPossession === "home" ? "away" : "home";
  decayTeam(state, otherTeam, OUT_OF_POSSESSION_DECAY);
  decayTeam(state, teamInPossession, POSSESSION_DECAY);

  let delta = possessionBaseDelta(state);
  for (const event of state.eventsThisTick) {
    delta += momentumDeltaFromEvent(event, teamInPossession);
  }

  if (state.eventsThisTick.some((event) => event.type === "goal_scored" || event.type === "goal")) {
    state.attackMomentum.home = 0;
    state.attackMomentum.away = 0;
    state.possessionStreak = { teamId: null, ticks: 0 };
    return;
  }

  state.attackMomentum[teamInPossession] = clampMomentum(
    state.attackMomentum[teamInPossession] + delta
  );
}

function updatePossessionStreak(state: MutableMatchState, teamInPossession: TeamId | null): void {
  if (!teamInPossession) {
    state.possessionStreak = { teamId: null, ticks: 0 };
    return;
  }

  if (state.possessionStreak.teamId === teamInPossession) {
    state.possessionStreak.ticks += 1;
    return;
  }

  if (state.possessionStreak.teamId) {
    state.attackMomentum[state.possessionStreak.teamId] *= TURNOVER_RETAINED_MOMENTUM;
  }
  state.possessionStreak = { teamId: teamInPossession, ticks: 1 };
}

function possessionBaseDelta(state: MutableMatchState): number {
  const streakBonus = Math.min(2, state.possessionStreak.ticks * 0.05);
  if (state.possession.zone === "att") {
    return 0.55 + streakBonus;
  }
  if (state.possession.zone === "mid") {
    return 0.22 + streakBonus;
  }
  return -0.15 + streakBonus * 0.35;
}

function momentumDeltaFromEvent(event: SemanticEvent, teamInPossession: TeamId): number {
  if (event.team !== teamInPossession) {
    if (event.type === "possession_change") {
      return 2;
    }
    return 0;
  }

  if (event.type === "pass") {
    return passMomentum(event);
  }
  if (event.type === "carry") {
    return carryMomentum(event);
  }
  if (event.type === "shot") {
    return -12;
  }
  if (event.type === "corner" || event.type === "free_kick") {
    return 4;
  }
  if (event.type === "throw_in") {
    return -4;
  }
  if (event.type === "goal_kick" || event.type === "kick_off") {
    return -10;
  }
  if (event.type === "possession_change") {
    return possessionChangeMomentum(event);
  }
  return 0;
}

function passMomentum(event: SemanticEvent): number {
  const passType = event.detail?.passType as PassType | undefined;
  const complete = event.detail?.complete !== false;
  if (!complete) {
    return -8;
  }

  let delta = 0;
  if (event.detail?.progressive === true) {
    delta += 6;
  }
  if (event.detail?.keyPass === true) {
    delta += 5;
  }
  if (passType === "cross" || passType === "cutback" || passType === "through_ball") {
    delta += 5;
  } else if (passType === "back") {
    delta -= 5;
  } else if (passType === "switch" || passType === "long") {
    delta += 3;
  }
  return delta;
}

function carryMomentum(event: SemanticEvent): number {
  let delta = event.detail?.progressive === true ? 5 : 1;
  if (event.detail?.carryType === "flank_drive") {
    delta += 5;
  }
  return delta;
}

function possessionChangeMomentum(event: SemanticEvent): number {
  const cause = event.detail?.cause;
  if (cause === "kickoff_after_goal" || cause === "kickoff_match_start") {
    return -10;
  }
  if (cause === "restart_corner") {
    return 5;
  }
  if (cause === "restart_throw_in" || cause === "restart_goal_kick") {
    return -3;
  }
  return 2;
}

function decayTeam(state: MutableMatchState, teamId: TeamId, multiplier: number): void {
  state.attackMomentum[teamId] = clampMomentum(state.attackMomentum[teamId] * multiplier);
}

function clampMomentum(value: number): number {
  return Math.max(0, Math.min(MAX_MOMENTUM, value));
}

// LEGACY: fixed first-half-throughout progress for pre-Phase-7 tests/helpers.
export function attackingThirdProgress(teamId: TeamId, y: number): number {
  return teamId === "home" ? y / PITCH_LENGTH : (PITCH_LENGTH - y) / PITCH_LENGTH;
}

export function attackingThirdProgressForDirection(y: number, direction: AttackDirection): number {
  return direction === 1 ? y / PITCH_LENGTH : (PITCH_LENGTH - y) / PITCH_LENGTH;
}
