import type { MatchDetails, Player, PlayerStats, Team, TeamStatistics } from "@the-ataturk/engine";

export type SemanticEventType = "goal" | "shot" | "save" | "foul" | "yellow" | "red";
export type SemanticEventTeam = "home" | "away";

export interface SemanticEvent {
  type: SemanticEventType;
  team: SemanticEventTeam;
  playerId?: string;
  minute: number;
  second: number;
  detail?: string;
}

export interface EventClock {
  minute: number;
  seconds: number;
}

export function extractEvents(
  previous: MatchDetails,
  current: MatchDetails,
  clock: EventClock
): SemanticEvent[] {
  const playerEvents = [
    ...extractTeamPlayerEvents(previous.kickOffTeam, current.kickOffTeam, "home", clock),
    ...extractTeamPlayerEvents(previous.secondTeam, current.secondTeam, "away", clock)
  ];

  return [
    ...playerEvents,
    ...extractTeamStatisticEvents(
      previous.kickOffTeamStatistics,
      current.kickOffTeamStatistics,
      "home",
      clock,
      playerEvents
    ),
    ...extractTeamStatisticEvents(
      previous.secondTeamStatistics,
      current.secondTeamStatistics,
      "away",
      clock,
      playerEvents
    )
  ];
}

function extractTeamPlayerEvents(
  previousTeam: Team,
  currentTeam: Team,
  team: SemanticEventTeam,
  clock: EventClock
): SemanticEvent[] {
  const events: SemanticEvent[] = [];

  for (const currentPlayer of currentTeam.players) {
    const previousPlayer = previousTeam.players.find(
      (candidate) => candidate.playerID === currentPlayer.playerID
    );

    if (!previousPlayer) {
      continue;
    }

    const playerId = String(currentPlayer.playerID);
    const goalDelta = currentPlayer.stats.goals - previousPlayer.stats.goals;
    for (let count = 0; count < goalDelta; count += 1) {
      events.push(baseEvent("goal", team, playerId, clock));
    }

    events.push(
      ...shotEventsFromPlayer(previousPlayer.stats, currentPlayer.stats, team, playerId, clock)
    );

    const saveDelta = saves(currentPlayer.stats) - saves(previousPlayer.stats);
    for (let count = 0; count < saveDelta; count += 1) {
      events.push(baseEvent("save", team, playerId, clock));
    }

    const foulDelta = currentPlayer.stats.tackles.fouls - previousPlayer.stats.tackles.fouls;
    for (let count = 0; count < foulDelta; count += 1) {
      events.push(baseEvent("foul", team, playerId, clock));
    }

    const yellowDelta = currentPlayer.stats.cards.yellow - previousPlayer.stats.cards.yellow;
    for (let count = 0; count < yellowDelta; count += 1) {
      events.push(baseEvent("yellow", team, playerId, clock));
    }

    const redDelta = currentPlayer.stats.cards.red - previousPlayer.stats.cards.red;
    for (let count = 0; count < redDelta; count += 1) {
      events.push(baseEvent("red", team, playerId, clock));
    }
  }

  return events;
}

function shotEventsFromPlayer(
  previousStats: PlayerStats,
  currentStats: PlayerStats,
  team: SemanticEventTeam,
  playerId: string,
  clock: EventClock
): SemanticEvent[] {
  const events: SemanticEvent[] = [];
  const onTargetDelta = currentStats.shots.on - previousStats.shots.on;
  const offTargetDelta = currentStats.shots.off - previousStats.shots.off;
  const totalDelta = currentStats.shots.total - previousStats.shots.total;

  for (let count = 0; count < onTargetDelta; count += 1) {
    events.push(baseEvent("shot", team, playerId, clock, "on_target"));
  }

  for (let count = 0; count < offTargetDelta; count += 1) {
    events.push(baseEvent("shot", team, playerId, clock, "off_target"));
  }

  const classifiedDelta = onTargetDelta + offTargetDelta;
  for (let count = classifiedDelta; count < totalDelta; count += 1) {
    events.push(baseEvent("shot", team, playerId, clock));
  }

  return events;
}

function extractTeamStatisticEvents(
  previousStatistics: TeamStatistics,
  currentStatistics: TeamStatistics,
  team: SemanticEventTeam,
  clock: EventClock,
  existingEvents: SemanticEvent[]
): SemanticEvent[] {
  const events: SemanticEvent[] = [];
  const existingGoals = existingEvents.filter(
    (event) => event.team === team && event.type === "goal"
  ).length;
  const goalDelta = numeric(currentStatistics.goals) - numeric(previousStatistics.goals);

  for (let count = existingGoals; count < goalDelta; count += 1) {
    events.push(baseEvent("goal", team, undefined, clock));
  }

  const existingShots = existingEvents.filter(
    (event) => event.team === team && event.type === "shot"
  ).length;
  const shotDelta = currentStatistics.shots.total - previousStatistics.shots.total;
  const onTargetDelta = currentStatistics.shots.on - previousStatistics.shots.on;
  const offTargetDelta = currentStatistics.shots.off - previousStatistics.shots.off;

  for (let count = existingShots; count < shotDelta; count += 1) {
    const detail =
      count < onTargetDelta
        ? "on_target"
        : count < onTargetDelta + offTargetDelta
          ? "off_target"
          : undefined;
    events.push(baseEvent("shot", team, undefined, clock, detail));
  }

  const existingFouls = existingEvents.filter(
    (event) => event.team === team && event.type === "foul"
  ).length;
  const foulDelta = numeric(currentStatistics.fouls) - numeric(previousStatistics.fouls);
  for (let count = existingFouls; count < foulDelta; count += 1) {
    events.push(baseEvent("foul", team, undefined, clock));
  }

  return events;
}

function baseEvent(
  type: SemanticEventType,
  team: SemanticEventTeam,
  playerId: string | undefined,
  clock: EventClock,
  detail?: string
): SemanticEvent {
  return {
    type,
    team,
    minute: clock.minute,
    second: clock.seconds,
    ...(playerId ? { playerId } : {}),
    ...(detail ? { detail } : {})
  };
}

function saves(stats: PlayerStats): number {
  return typeof stats.saves === "number" ? stats.saves : 0;
}

function numeric(value: TeamStatistics[keyof TeamStatistics]): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return value.total;
}

export function findPlayerName(
  matchDetails: MatchDetails,
  playerId: string | undefined
): string | null {
  if (!playerId) {
    return null;
  }

  const player = [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players].find(
    (candidate: Player) => String(candidate.playerID) === playerId
  );

  return player?.name ?? null;
}
