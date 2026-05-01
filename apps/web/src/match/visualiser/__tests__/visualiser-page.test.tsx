import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatchSnapshot } from "@the-ataturk/match-engine";

import { VisualiserPage } from "../VisualiserPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
    expect(screen.getAllByText(/shot/).length).toBeGreaterThan(0);
    expect(screen.getByText("Shooting")).toBeTruthy();
    expect(screen.getByText("On / off / blocked")).toBeTruthy();
    expect(screen.getByText("Passing and carries")).toBeTruthy();
    expect(screen.getByText("Restarts and turnovers")).toBeTruthy();
    expect(screen.getByText("Territory and momentum")).toBeTruthy();
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
    const overlay = screen.getByRole("status");
    expect(overlay.textContent).toContain("LIV 1-3 MIL");
    expect(overlay.textContent).toContain("LIV scored by HF at 45:03");
  });

  it("keeps goal overlay score in home-away order when the away team scores", async () => {
    const snapshot = createSnapshot();
    snapshot.ticks[0]!.score = { home: 1, away: 4 };
    snapshot.ticks[0]!.events = [
      {
        type: "goal_scored",
        team: "away",
        playerId: "a1",
        minute: 49,
        second: 12,
        detail: { score: { home: 1, away: 4 } }
      }
    ];
    const file = new File([JSON.stringify(snapshot)], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/GOAL!/)).toBeTruthy());
    const overlay = screen.getByRole("status");
    expect(overlay.textContent).toContain("LIV 1-4 MIL");
    expect(overlay.textContent).toContain("MIL scored by AF at 49:12");
    expect(overlay.textContent).not.toContain("MIL 1-4 LIV");
  });

  it("renders rich event detail fields and legacy possession changes", async () => {
    const snapshot = createSnapshot();
    snapshot.ticks[0]!.events = [
      {
        type: "shot",
        team: "home",
        playerId: "h1",
        minute: 45,
        second: 3,
        detail: {
          onTarget: true,
          shotType: "power",
          distanceBand: "edge",
          pressure: "high",
          distanceToGoalMetres: 28
        }
      },
      {
        type: "possession_change",
        team: "away",
        playerId: "a1",
        minute: 45,
        second: 6,
        detail: {
          from: "home",
          to: "away",
          cause: "intercepted_pass",
          previousPossessor: "h1",
          zone: "mid"
        }
      },
      {
        type: "save",
        team: "away",
        playerId: "a0",
        minute: 45,
        second: 9,
        detail: { quality: "good", result: "parried_safe", shooterId: "h1" }
      },
      {
        type: "pass",
        team: "home",
        playerId: "h1",
        minute: 45,
        second: 12,
        detail: {
          passType: "long",
          complete: true,
          keyPass: true,
          progressive: true,
          targetPlayerId: "h0"
        }
      },
      {
        type: "carry",
        team: "home",
        playerId: "h1",
        minute: 45,
        second: 13,
        detail: {
          carryType: "flank_drive",
          progressive: true,
          flank: "right",
          zone: "att"
        }
      },
      {
        type: "foul",
        team: "away",
        playerId: "a1",
        minute: 45,
        second: 15,
        detail: { severity: "reckless", tackleType: "sliding", location: "att", on: "h1" }
      },
      {
        type: "yellow",
        team: "away",
        playerId: "a1",
        minute: 45,
        second: 16,
        detail: { cardCount: 2, on: "h1" }
      },
      {
        type: "possession_change",
        team: "home",
        playerId: "h1",
        minute: 45,
        second: 18,
        detail: { from: "away", to: "home" }
      },
      {
        type: "full_time",
        team: "home",
        minute: 90,
        second: 0,
        detail: { finalScore: { home: 1, away: 3 } }
      }
    ];
    const file = new File([JSON.stringify(snapshot)], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText(/power/)).toBeTruthy());
    expect(screen.getByText(/high pressure/)).toBeTruthy();
    expect(screen.getByText(/intercepted/)).toBeTruthy();
    expect(screen.getByText(/parried safe/)).toBeTruthy();
    expect(screen.getByText(/key pass/)).toBeTruthy();
    expect(screen.getByText(/flank_drive/)).toBeTruthy();
    expect(screen.getByText(/sliding/)).toBeTruthy();
    expect(screen.getByText(/second booking/)).toBeTruthy();
    expect(screen.getByText(/cause unknown/)).toBeTruthy();
    expect(screen.getByText(/Full time/)).toBeTruthy();
    expect(screen.getByText(/1-3/)).toBeTruthy();
  });

  it("renders heatmap diagnostics from the loaded snapshot", async () => {
    const snapshot = createSnapshot();
    snapshot.ticks[0]!.attackMomentum = { home: 47, away: 8 };
    snapshot.ticks[0]!.possessionStreak = { teamId: "home", ticks: 12 };
    snapshot.ticks[0]!.diagnostics = {
      shape: {
        home: shapeDiagnostics(2, 410),
        away: shapeDiagnostics(2, 390)
      }
    };
    snapshot.ticks.push({
      iteration: 2,
      matchClock: { half: 2, minute: 45, seconds: 6 },
      ball: { position: [600, 820, 0], inFlight: false, carrierPlayerId: "h1" },
      players: snapshot.ticks[0]!.players,
      score: { home: 0, away: 3 },
      possession: { teamId: "home", zone: "att" },
      attackMomentum: { home: 55, away: 5 },
      possessionStreak: { teamId: "home", ticks: 13 },
      diagnostics: {
        shape: {
          home: shapeDiagnostics(2, 430),
          away: shapeDiagnostics(2, 380)
        }
      },
      events: []
    });
    const file = new File([JSON.stringify(snapshot)], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("LIV 0-3 MIL")).toBeTruthy());
    selectHeatmapView();

    expect(screen.getByRole("img", { name: "Ball-position heatmap" })).toBeTruthy();
    expect(screen.getByText(/LIV momentum: 47/)).toBeTruthy();
    expect(screen.getByText(/streak: LIV 12 ticks/)).toBeTruthy();
    expect(screen.getAllByText("Shape").length).toBeGreaterThan(0);
    expect(screen.getByText("LIV active")).toBeTruthy();
    expect(screen.getByText("LIV line")).toBeTruthy();
    expect(screen.getByText("Attacking third")).toBeTruthy();
    expect(screen.getByText("Right flank")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Heatmap subject"), {
      target: { value: "home_players" }
    });

    expect(screen.getByRole("img", { name: "Home player-position heatmap" })).toBeTruthy();
    expect(screen.getByLabelText("Heatmap possession filter")).toHaveProperty("disabled", true);
  });

  it("degrades gracefully when old snapshots do not expose momentum", async () => {
    const file = new File([JSON.stringify(createSnapshot())], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("LIV 0-3 MIL")).toBeTruthy());
    selectHeatmapView();

    expect(screen.getByText(/Momentum: unavailable/)).toBeTruthy();
    expect(screen.getByText(/Shape diagnostics unavailable/)).toBeTruthy();
  });

  it("loads snapshots from the artifact browser", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url = requestUrl(input);

      if (url === "/api/visualiser/artifacts") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              files: [
                {
                  filename: "representative-seed-1-v2.json",
                  sizeBytes: 1024,
                  modifiedAt: "2026-05-01T08:00:00.000Z"
                }
              ]
            })
          )
        );
      }

      if (url === "/api/visualiser/artifacts/representative-seed-1-v2.json") {
        return Promise.resolve(new Response(JSON.stringify(createSnapshot())));
      }

      return Promise.resolve(new Response("not found", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VisualiserPage />);

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /representative-seed-1-v2.json/ })).toBeTruthy()
    );

    fireEvent.change(screen.getByLabelText("Snapshot artifact"), {
      target: { value: "representative-seed-1-v2.json" }
    });

    await waitFor(() => expect(screen.getByText("LIV 0-3 MIL")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledWith("/api/visualiser/artifacts");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/visualiser/artifacts/representative-seed-1-v2.json"
    );
  });

  it("renders player-relative heatmaps split by team possession", async () => {
    const snapshot = createSnapshot();
    snapshot.ticks.push({
      iteration: 2,
      matchClock: { half: 2, minute: 45, seconds: 6 },
      ball: { position: [420, 540, 0], inFlight: false, carrierPlayerId: "a1" },
      players: [
        { id: "h0", teamId: "home", position: [340, 40], hasBall: false, onPitch: true },
        { id: "h1", teamId: "home", position: [390, 525], hasBall: false, onPitch: true },
        { id: "a0", teamId: "away", position: [340, 1010], hasBall: false, onPitch: true },
        { id: "a1", teamId: "away", position: [420, 540], hasBall: true, onPitch: true }
      ],
      score: { home: 0, away: 3 },
      possession: { teamId: "away", zone: "mid" },
      events: []
    });
    const file = new File([JSON.stringify(snapshot)], "snapshot.json", {
      type: "application/json"
    });

    render(<VisualiserPage />);

    const input = screen.getByLabelText("Load snapshot JSON");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("LIV 0-3 MIL")).toBeTruthy());
    selectHeatmapView();
    fireEvent.change(screen.getByLabelText("Heatmap subject"), {
      target: { value: "player_relative" }
    });
    fireEvent.change(screen.getByLabelText("Heatmap player"), { target: { value: "h1" } });

    expect(
      screen.getByRole("img", { name: "Team in possession relative player heatmap" })
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Team out of possession relative player heatmap" })
    ).toBeTruthy();
    expect(screen.getByText(/Relative to ball/)).toBeTruthy();
    expect(screen.getByText("In possession samples")).toBeTruthy();
    expect(screen.getByText("Out of possession samples")).toBeTruthy();
  });
});

function selectHeatmapView(): void {
  const viewMode = screen.getByLabelText("Visualiser view mode");
  fireEvent.click(within(viewMode).getByRole("button", { name: "Heatmap" }));
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function shapeDiagnostics(activePlayers: number, teamLine: number) {
  return {
    activePlayers,
    lineHeight: {
      team: teamLine,
      defence: teamLine - 140,
      midfield: teamLine,
      attack: teamLine + 160
    },
    spread: {
      width: 280,
      depth: 420,
      compactness: 190
    },
    thirds: {
      defensive: 1,
      middle: 1,
      attacking: 0
    },
    oppositionHalfPlayers: 1,
    ballSidePlayers: 1
  };
}

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
