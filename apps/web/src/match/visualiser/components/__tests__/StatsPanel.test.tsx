import { cleanup, render, screen } from "@testing-library/react";
import type { MatchSnapshot, MatchTick } from "@the-ataturk/match-engine";
import { afterEach, describe, expect, it } from "vitest";

import { StatsPanel, statsForReplay } from "../StatsPanel";

afterEach(() => {
  cleanup();
});

describe("StatsPanel", () => {
  it("aggregates replay stats and renders the main stat sections", () => {
    const ticks = createTicks();
    const snapshot = createSnapshot(ticks);
    const stats = statsForReplay(ticks);

    render(<StatsPanel snapshot={snapshot} tick={ticks[1]!} stats={stats} />);

    expect(screen.getByText("Shooting")).toBeTruthy();
    expect(screen.getByText("Passing and carries")).toBeTruthy();
    expect(screen.getByText("Territory and momentum")).toBeTruthy();
    expect(screen.getAllByText("1-0")).toHaveLength(2);
    expect(screen.getByText("1 / 0 / 0")).toBeTruthy();
    expect(screen.getByText("1/1 (0 inc)")).toBeTruthy();
  });

  it("uses tick direction for attacking-third territory", () => {
    const ticks = createTicks();
    ticks[0] = {
      ...ticks[0]!,
      ball: { position: [340, 100, 0], inFlight: false, carrierPlayerId: "home-9" },
      attackDirection: { home: -1, away: 1 }
    };
    ticks[1] = {
      ...ticks[1]!,
      ball: { position: [340, 120, 0], inFlight: false, carrierPlayerId: "home-9" },
      attackDirection: { home: -1, away: 1 }
    };

    const stats = statsForReplay(ticks);

    expect(stats.territory.homeAttackingThird).toBe(100);
  });
});

function createSnapshot(ticks: MatchTick[]): MatchSnapshot {
  return {
    meta: {
      homeTeam: { id: "home", name: "Liverpool", shortName: "LIV" },
      awayTeam: { id: "away", name: "Milan", shortName: "MIL" },
      rosters: {
        home: [{ id: "home-9", name: "Home ST", shortName: "ST9", position: "ST" }],
        away: [{ id: "away-1", name: "Away GK", shortName: "GK1", position: "GK" }]
      },
      seed: 1,
      duration: "second_half",
      preMatchScore: { home: 0, away: 0 },
      generatedAt: "2026-05-02T12:00:00.000Z",
      targets: {
        shotsTarget: [8, 12],
        goalsTarget: [1, 3],
        foulsTarget: [4, 8],
        cardsTarget: [1, 3],
        maxSingleScoreShare: 0.4
      }
    },
    ticks,
    finalSummary: {
      finalScore: { home: 1, away: 0 },
      statistics: {
        home: {
          goals: 1,
          shots: { total: 1, on: 1, off: 0, blocked: 0 },
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          corners: 0,
          possession: 50
        },
        away: {
          goals: 0,
          shots: { total: 0, on: 0, off: 0, blocked: 0 },
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          corners: 0,
          possession: 50
        }
      }
    }
  };
}

function createTicks(): MatchTick[] {
  return [
    {
      iteration: 0,
      matchClock: { half: 2, minute: 45, seconds: 0 },
      ball: { position: [340, 700, 0], inFlight: false, carrierPlayerId: "home-9" },
      players: [],
      score: { home: 0, away: 0 },
      possession: { teamId: "home", zone: "att" },
      attackMomentum: { home: 12, away: 3 },
      possessionStreak: { teamId: "home", ticks: 1 },
      events: [
        {
          type: "pass",
          team: "home",
          playerId: "home-9",
          minute: 45,
          second: 0,
          detail: { complete: true, progressive: true, keyPass: true, passType: "cross" }
        }
      ]
    },
    {
      iteration: 1,
      matchClock: { half: 2, minute: 45, seconds: 3 },
      ball: { position: [340, 780, 0], inFlight: false, carrierPlayerId: "home-9" },
      players: [],
      score: { home: 1, away: 0 },
      possession: { teamId: "home", zone: "att" },
      attackMomentum: { home: 20, away: 2 },
      possessionStreak: { teamId: "home", ticks: 2 },
      events: [
        {
          type: "shot",
          team: "home",
          playerId: "home-9",
          minute: 45,
          second: 3,
          detail: { onTarget: true }
        },
        {
          type: "goal_scored",
          team: "home",
          playerId: "home-9",
          minute: 45,
          second: 3
        }
      ]
    }
  ];
}
