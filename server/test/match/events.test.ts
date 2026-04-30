import type { MatchDetails } from "@the-ataturk/engine";
import { describe, expect, it } from "vitest";

import { extractEvents } from "../../src/match/events";

function createMatchDetails(): MatchDetails {
  return {
    matchID: "test",
    pitchSize: [680, 1050],
    half: 2,
    iterationLog: [],
    ball: {
      position: [340, 525, 0],
      withPlayer: true,
      Player: "home-player",
      withTeam: "home",
      direction: "south",
      ballOverIterations: [],
      lastTouch: {
        playerName: "Home Player",
        playerID: "home-player",
        teamID: "home"
      }
    },
    kickOffTeam: {
      name: "Liverpool",
      teamID: "home",
      intent: "attack",
      players: [createPlayer("home-player")]
    },
    secondTeam: {
      name: "AC Milan",
      teamID: "away",
      intent: "defend",
      players: [createPlayer("away-player")]
    },
    kickOffTeamStatistics: createStatistics(),
    secondTeamStatistics: createStatistics()
  };
}

function createPlayer(playerID: string) {
  return {
    playerID,
    name: playerID,
    position: "ST",
    rating: 70,
    skill: {
      passing: 70,
      shooting: 70,
      tackling: 70,
      saving: 10,
      agility: 70,
      strength: 70,
      penalty_taking: 70,
      perception: 70,
      jumping: 70,
      control: 70
    },
    currentPOS: [340, 525] as [number, number],
    originPOS: [340, 525] as [number, number],
    intentPOS: [340, 525] as [number, number],
    fitness: 92,
    height: 180,
    injured: false,
    action: "none",
    offside: false,
    hasBall: false,
    stats: {
      goals: 0,
      shots: {
        total: 0,
        on: 0,
        off: 0
      },
      cards: {
        yellow: 0,
        red: 0
      },
      passes: {
        total: 0,
        on: 0,
        off: 0
      },
      tackles: {
        total: 0,
        on: 0,
        off: 0,
        fouls: 0
      }
    }
  };
}

function createStatistics() {
  return {
    goals: 0,
    shots: {
      total: 0,
      on: 0,
      off: 0
    },
    corners: 0,
    freekicks: 0,
    penalties: 0,
    fouls: 0
  };
}

describe("extractEvents", () => {
  it("returns no events when there is no state change", () => {
    const previous = createMatchDetails();
    const current = structuredClone(previous);

    expect(extractEvents(previous, current, { minute: 45, seconds: 6 })).toEqual([]);
  });

  it("emits a home goal when the kickoff team goal count increments", () => {
    const previous = createMatchDetails();
    const current = structuredClone(previous);
    current.kickOffTeamStatistics.goals = 1;

    expect(extractEvents(previous, current, { minute: 46, seconds: 0 })).toEqual([
      {
        type: "goal",
        team: "home",
        minute: 46,
        second: 0
      }
    ]);
  });

  it("emits an on-target shot from player-stat deltas", () => {
    const previous = createMatchDetails();
    const current = structuredClone(previous);
    current.kickOffTeam.players[0]!.stats.shots.total = 1;
    current.kickOffTeam.players[0]!.stats.shots.on = 1;

    expect(extractEvents(previous, current, { minute: 47, seconds: 12 })).toEqual([
      {
        type: "shot",
        team: "home",
        playerId: "home-player",
        minute: 47,
        second: 12,
        detail: "on_target"
      }
    ]);
  });

  it("emits multiple events from the same iteration", () => {
    const previous = createMatchDetails();
    const current = structuredClone(previous);
    current.kickOffTeam.players[0]!.stats.goals = 1;
    current.kickOffTeamStatistics.goals = 1;
    current.secondTeam.players[0]!.stats.tackles.fouls = 1;
    current.secondTeamStatistics.fouls = 1;

    expect(extractEvents(previous, current, { minute: 52, seconds: 30 })).toEqual([
      {
        type: "goal",
        team: "home",
        playerId: "home-player",
        minute: 52,
        second: 30
      },
      {
        type: "foul",
        team: "away",
        playerId: "away-player",
        minute: 52,
        second: 30
      }
    ]);
  });
});
