import { cleanup, render, screen } from "@testing-library/react";
import type { MatchSnapshot, SemanticEvent } from "@the-ataturk/match-engine";
import { afterEach, describe, expect, it } from "vitest";

import { EventDock, formatEventDetail } from "../EventDock";

afterEach(() => {
  cleanup();
});

describe("EventDock", () => {
  it("renders rich event detail fields and legacy possession changes", () => {
    const snapshot = createSnapshot();
    const events: SemanticEvent[] = [
      {
        type: "shot",
        team: "home",
        playerId: "h1",
        minute: 47,
        second: 32,
        detail: {
          onTarget: true,
          distanceBand: "edge",
          shotType: "power",
          pressure: "high",
          foot: "preferred",
          distanceToGoalMetres: 28
        }
      },
      {
        type: "possession_change",
        team: "away",
        playerId: "a1",
        minute: 52,
        second: 8,
        detail: {
          cause: "intercepted_pass",
          previousPossessor: "h1",
          zone: "mid"
        }
      },
      {
        type: "pass",
        team: "home",
        playerId: "h1",
        minute: 73,
        second: 42,
        detail: {
          passType: "long",
          targetPlayerId: "h2",
          progressive: true,
          keyPass: true,
          complete: true
        }
      },
      {
        type: "possession_change",
        team: "home",
        minute: 74,
        second: 0,
        detail: { from: "away", to: "home" }
      }
    ];

    render(<EventDock snapshot={snapshot} events={events} />);

    expect(screen.getByText(/shot/)).toBeTruthy();
    expect(screen.getByText(/edge/)).toBeTruthy();
    expect(screen.getByText(/high pressure/)).toBeTruthy();
    expect(screen.getByText(/AF intercepted HF, midfield/)).toBeTruthy();
    expect(screen.getByText(/to HM/)).toBeTruthy();
    expect(screen.getByText(/key pass/)).toBeTruthy();
    expect(screen.getByText(/cause unknown/)).toBeTruthy();
  });

  it("exposes the formatter for comparison timelines", () => {
    const snapshot = createSnapshot();
    const detail = formatEventDetail(snapshot, {
      type: "save",
      team: "away",
      playerId: "a0",
      minute: 60,
      second: 1,
      detail: { quality: "good", result: "parried_safe" }
    });

    expect(detail).toBe("(good, parried safe)");
  });
});

function createSnapshot(): MatchSnapshot {
  return {
    meta: {
      homeTeam: { id: "liverpool", name: "Liverpool", shortName: "LIV" },
      awayTeam: { id: "milan", name: "Milan", shortName: "MIL" },
      rosters: {
        home: [
          { id: "h1", name: "Home Forward", shortName: "HF", position: "ST" },
          { id: "h2", name: "Home Midfielder", shortName: "HM", position: "CM" }
        ],
        away: [
          { id: "a0", name: "Away Keeper", shortName: "AK", position: "GK" },
          { id: "a1", name: "Away Forward", shortName: "AF", position: "ST" }
        ]
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
    ticks: [],
    finalSummary: {
      finalScore: { home: 0, away: 0 },
      statistics: {
        home: {
          goals: 0,
          shots: { total: 0, on: 0, off: 0, blocked: 0 },
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
