import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MatchSnapshot } from "@the-ataturk/match-engine";

import { VisualiserPage } from "../VisualiserPage";

afterEach(() => {
  cleanup();
});

describe("VisualiserPage", () => {
  it("loads a snapshot JSON file and renders the replay", async () => {
    const file = new File([JSON.stringify(createSnapshot())], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("LIV 0-3 MIL")).toBeTruthy());
    expect(screen.getByRole("img", { name: "Football pitch" })).toBeTruthy();
    expect(screen.getAllByText(/45:03/).length).toBeGreaterThan(0);
    expect(screen.getByText(/shot/)).toBeTruthy();
  });

  it("shows a prominent goal overlay for recent goal events", async () => {
    const snapshot = createSnapshot();
    snapshot.ticks[0]!.score = { home: 1, away: 3 };
    snapshot.ticks[0]!.events = [
      {
        type: "goal_scored",
        team: "home",
        playerId: "h1",
        minute: 45,
        second: 3,
        detail: { score: { home: 1, away: 3 } }
      }
    ];
    const file = new File([JSON.stringify(snapshot)], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/GOAL!/)).toBeTruthy());
    expect(screen.getByText(/scored by HF at 45:03/)).toBeTruthy();
  });
});

function createSnapshot(): MatchSnapshot {
  return {
    meta: {
      homeTeam: { id: "liverpool", name: "Liverpool", shortName: "LIV" },
      awayTeam: { id: "ac-milan", name: "AC Milan", shortName: "MIL" },
      rosters: {
        home: [
          { id: "h0", name: "Home Keeper", shortName: "HK", squadNumber: 1, position: "GK" },
          { id: "h1", name: "Home Forward", shortName: "HF", squadNumber: 9, position: "ST" }
        ],
        away: [
          { id: "a0", name: "Away Keeper", shortName: "AK", squadNumber: 1, position: "GK" },
          { id: "a1", name: "Away Forward", shortName: "AF", squadNumber: 9, position: "ST" }
        ]
      },
      seed: 1,
      duration: "second_half",
      preMatchScore: { home: 0, away: 3 },
      generatedAt: "2005-05-25T18:45:00.000Z",
      targets: {
        shotsTarget: [8, 12],
        goalsTarget: [1, 3],
        foulsTarget: [4, 8],
        cardsTarget: [1, 3],
        maxSingleScoreShare: 0.4
      }
    },
    ticks: [
      {
        iteration: 1,
        matchClock: { half: 2, minute: 45, seconds: 3 },
        ball: { position: [340, 525, 0], inFlight: false, carrierPlayerId: "h1" },
        players: [
          { id: "h0", teamId: "home", position: [340, 40], hasBall: false, onPitch: true },
          { id: "h1", teamId: "home", position: [340, 525], hasBall: true, onPitch: true },
          { id: "a0", teamId: "away", position: [340, 1010], hasBall: false, onPitch: true },
          { id: "a1", teamId: "away", position: [340, 530], hasBall: false, onPitch: true }
        ],
        score: { home: 0, away: 3 },
        possession: { teamId: "home", zone: "mid" },
        events: [{ type: "shot", team: "home", playerId: "h1", minute: 45, second: 3 }]
      }
    ],
    finalSummary: {
      finalScore: { home: 0, away: 3 },
      statistics: {
        home: {
          goals: 0,
          shots: { total: 1, on: 0, off: 1, blocked: 0 },
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          corners: 0,
          possession: 55
        },
        away: {
          goals: 3,
          shots: { total: 0, on: 0, off: 0, blocked: 0 },
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          corners: 0,
          possession: 45
        }
      }
    }
  };
}
