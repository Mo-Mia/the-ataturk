import { SUBSTITUTIONS } from "../calibration/probabilities";
import type { MutableMatchState, MutablePlayer } from "../state/matchState";
import { emitEvent } from "../ticks/runTick";
import type { Position, ScheduledSubstitution, SubstitutionReason, TeamId } from "../types";

const ADJACENT_POSITIONS: Record<Position, readonly Position[]> = {
  GK: [],
  LB: ["CB", "RB", "LM"],
  RB: ["CB", "LB", "RM"],
  CB: ["LB", "RB", "DM"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM", "LM", "RM"],
  AM: ["CM", "LW", "RW", "ST"],
  LM: ["LW", "CM", "RM"],
  RM: ["RW", "CM", "LM"],
  LW: ["LM", "RW", "ST"],
  RW: ["RM", "LW", "ST"],
  ST: ["LW", "RW", "AM"]
};

export function processSubstitutions(state: MutableMatchState): void {
  processScheduledSubstitutions(state);
  if (state.dynamics.autoSubs) {
    processAutoSubstitutions(state);
  }
}

function processScheduledSubstitutions(state: MutableMatchState): void {
  const due: ScheduledSubstitution[] = [];
  const future: ScheduledSubstitution[] = [];

  for (const substitution of state.scheduledSubstitutions) {
    const second = substitution.second ?? 0;
    if (
      state.matchClock.minute > substitution.minute ||
      (state.matchClock.minute === substitution.minute && state.matchClock.seconds >= second)
    ) {
      due.push(substitution);
    } else {
      future.push(substitution);
    }
  }

  state.scheduledSubstitutions = future;
  for (const substitution of due) {
    applySubstitution(
      state,
      substitution.teamId,
      substitution.playerOutId,
      substitution.playerInId,
      "manual",
      "manual"
    );
  }
}

function processAutoSubstitutions(state: MutableMatchState): void {
  if (state.matchClock.minute < SUBSTITUTIONS.aiStartMinute) {
    return;
  }

  for (const teamId of ["home", "away"] as const) {
    if (!canUseAutoSub(state, teamId)) {
      continue;
    }

    const tactical = tacticalCandidate(state, teamId);
    if (tactical && applyAutoCandidate(state, teamId, tactical, "auto-tactical")) {
      continue;
    }

    const fatigue = fatigueCandidate(state, teamId);
    if (fatigue) {
      applyAutoCandidate(state, teamId, fatigue, "auto-fatigue");
    }
  }
}

function canUseAutoSub(state: MutableMatchState, teamId: TeamId): boolean {
  if (state.substitutionCounts[teamId] >= SUBSTITUTIONS.maxPerTeam) {
    return false;
  }
  const lastSubstitutionTick = state.lastSubstitutionTick[teamId];
  return (
    lastSubstitutionTick === null ||
    state.iteration - lastSubstitutionTick >= SUBSTITUTIONS.cooldownTicks
  );
}

function tacticalCandidate(
  state: MutableMatchState,
  teamId: TeamId
): { out: MutablePlayer; replacement: MutablePlayer } | null {
  if (state.matchClock.minute < SUBSTITUTIONS.tacticalChaseMinute) {
    return null;
  }
  const deficit = state.score[teamId] - state.score[teamId === "home" ? "away" : "home"];
  if (deficit > -SUBSTITUTIONS.tacticalDeficit) {
    return null;
  }

  const out = activePlayers(state, teamId)
    .filter(
      (player) =>
        ["LB", "RB", "CB", "DM", "CM"].includes(player.baseInput.position) &&
        !reservedForScheduledSubstitution(state, teamId, player.id)
    )
    .sort(
      (a, b) =>
        a.stamina - b.stamina || a.baseInput.attributes.shooting - b.baseInput.attributes.shooting
    )[0];
  if (!out) {
    return null;
  }

  const replacement = benchPlayers(state, teamId)
    .filter(
      (player) =>
        ["ST", "LW", "RW", "AM", "LM", "RM"].includes(player.baseInput.position) &&
        !reservedForScheduledSubstitution(state, teamId, player.id)
    )
    .sort(
      (a, b) =>
        replacementScore(b, out.baseInput.position) - replacementScore(a, out.baseInput.position)
    )[0];
  return replacement ? { out, replacement } : null;
}

function fatigueCandidate(
  state: MutableMatchState,
  teamId: TeamId
): { out: MutablePlayer; replacement: MutablePlayer } | null {
  const out = activePlayers(state, teamId)
    .filter(
      (player) =>
        player.baseInput.position !== "GK" &&
        player.stamina <= SUBSTITUTIONS.fatigueThreshold &&
        !reservedForScheduledSubstitution(state, teamId, player.id)
    )
    .sort((a, b) => a.stamina - b.stamina)[0];
  if (!out) {
    return null;
  }

  const replacement = benchPlayers(state, teamId)
    .filter(
      (player) =>
        player.baseInput.position !== "GK" &&
        !reservedForScheduledSubstitution(state, teamId, player.id)
    )
    .sort(
      (a, b) =>
        replacementScore(b, out.baseInput.position) - replacementScore(a, out.baseInput.position)
    )[0];
  return replacement ? { out, replacement } : null;
}

function applyAutoCandidate(
  state: MutableMatchState,
  teamId: TeamId,
  candidate: { out: MutablePlayer; replacement: MutablePlayer },
  reason: SubstitutionReason
): boolean {
  return applySubstitution(
    state,
    teamId,
    candidate.out.id,
    candidate.replacement.id,
    reason,
    "auto"
  );
}

export function applySubstitution(
  state: MutableMatchState,
  teamId: TeamId,
  playerOutId: string,
  playerInId: string,
  reason: SubstitutionReason,
  mode: "manual" | "auto"
): boolean {
  if (state.substitutionCounts[teamId] >= SUBSTITUTIONS.maxPerTeam) {
    return false;
  }

  const playerOut = state.players.find(
    (player) => player.id === playerOutId && player.teamId === teamId && player.onPitch
  );
  const playerIn = state.players.find(
    (player) =>
      player.id === playerInId &&
      player.teamId === teamId &&
      !player.onPitch &&
      !player.redCard &&
      !player.substitutedIn &&
      !player.substitutedOut
  );
  if (!playerOut || !playerIn || playerOut.baseInput.position === "GK") {
    return false;
  }

  const inheritedRole = playerOut.baseInput.position;
  const hadBall = playerOut.hasBall;
  playerOut.onPitch = false;
  playerOut.substitutedOut = true;
  playerOut.hasBall = false;
  playerIn.onPitch = true;
  playerIn.substitutedIn = true;
  playerIn.hasBall = hadBall;
  playerIn.position = [...playerOut.position];
  playerIn.targetPosition = [...playerOut.targetPosition];
  playerIn.anchorPosition = [...playerOut.anchorPosition];
  playerIn.lateralAnchor = playerOut.lateralAnchor;
  playerIn.baseInput = { ...playerIn.baseInput, position: inheritedRole };
  if (hadBall) {
    state.ball.carrierPlayerId = playerIn.id;
  }

  state.substitutionCounts[teamId] += 1;
  state.lastSubstitutionTick[teamId] = state.iteration;
  const summary = {
    minute: state.matchClock.minute,
    second: state.matchClock.seconds,
    playerOutId,
    playerInId,
    reason,
    mode
  };
  state.substitutions[teamId].push(summary);
  emitEvent(state, "substitution", teamId, playerInId, summary);
  return true;
}

function activePlayers(state: MutableMatchState, teamId: TeamId): MutablePlayer[] {
  return state.players.filter((player) => player.teamId === teamId && player.onPitch);
}

function benchPlayers(state: MutableMatchState, teamId: TeamId): MutablePlayer[] {
  return state.players.filter(
    (player) =>
      player.teamId === teamId &&
      !player.onPitch &&
      !player.redCard &&
      !player.substitutedIn &&
      !player.substitutedOut
  );
}

function replacementScore(player: MutablePlayer, role: Position): number {
  const fit =
    player.baseInput.position === role
      ? 35
      : ADJACENT_POSITIONS[role].includes(player.baseInput.position)
        ? 18
        : 0;
  const attacking = ["ST", "LW", "RW", "AM", "LM", "RM"].includes(player.baseInput.position)
    ? player.baseInput.attributes.shooting / 2
    : 0;
  return fit + player.stamina + player.baseInput.attributes.control / 3 + attacking;
}

function reservedForScheduledSubstitution(
  state: MutableMatchState,
  teamId: TeamId,
  playerId: string
): boolean {
  return state.scheduledSubstitutions.some(
    (substitution) =>
      substitution.teamId === teamId &&
      (substitution.playerOutId === playerId || substitution.playerInId === playerId)
  );
}
