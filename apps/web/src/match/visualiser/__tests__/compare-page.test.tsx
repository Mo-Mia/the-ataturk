import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { MatchSnapshot, MatchTick } from "@the-ataturk/match-engine";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComparePage } from "../ComparePage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ComparePage", () => {
  it("renders two selected runs with summary diff and shared heatmap scale", async () => {
    const runA = run("run-a", 10, "liverpool", "manchester-city", "artifact-a.json", {
      home: 2,
      away: 1
    });
    const runB = run("run-b", 11, "liverpool", "manchester-city", "artifact-b.json", {
      home: 0,
      away: 3
    });
    const fetchMock = mockCompareFetch([runA, runB], {
      "artifact-a.json": snapshot("LIV", "MCI", { home: 2, away: 1 }, 820),
      "artifact-b.json": snapshot("LIV", "MCI", { home: 0, away: 3 }, 525)
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/visualise/compare?a=run-a&b=run-b"]}>
        <ComparePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Run A: 2-1, 18 shots/)).toBeTruthy());
    expect(screen.getByText(/Run B: 0-3, 18 shots/)).toBeTruthy();
    expect(screen.getByText(/attacking-third entries/)).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "Ball-position heatmap" })).toHaveLength(2);
    expect(
      screen
        .getAllByRole("img", { name: "Ball-position heatmap" })
        .every((element) => element.getAttribute("data-heatmap-max") === "2")
    ).toBe(true);
    expect(screen.getByLabelText("Run A events")).toBeTruthy();
    expect(screen.getByLabelText("Run B events")).toBeTruthy();
  });

  it("warns when comparing different matchups", async () => {
    const runA = run("run-a", 10, "liverpool", "manchester-city", "artifact-a.json", {
      home: 2,
      away: 1
    });
    const runB = run("run-b", 11, "arsenal", "aston-villa", "artifact-b.json", {
      home: 1,
      away: 1
    });
    vi.stubGlobal(
      "fetch",
      mockCompareFetch([runA, runB], {
        "artifact-a.json": snapshot("LIV", "MCI", { home: 2, away: 1 }, 820),
        "artifact-b.json": snapshot("ARS", "AVL", { home: 1, away: 1 }, 350)
      })
    );

    render(
      <MemoryRouter initialEntries={["/visualise/compare?a=run-a&b=run-b"]}>
        <ComparePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/different matchups/)).toBeTruthy();
  });
});

function mockCompareFetch(runs: unknown[], snapshots: Record<string, MatchSnapshot>) {
  return vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = requestUrl(input);
    if (url === "/api/match-engine/runs?page=1&limit=100") {
      return Promise.resolve(jsonResponse({ runs, total: runs.length, page: 1, hasMore: false }));
    }
    const runMatch = url.match(/^\/api\/match-engine\/runs\/(.+)$/);
    if (runMatch) {
      const found = runs.find(
        (candidate) =>
          typeof candidate === "object" &&
          candidate !== null &&
          "id" in candidate &&
          candidate.id === decodeURIComponent(runMatch[1]!)
      );
      return Promise.resolve(
        found ? jsonResponse(found) : jsonResponse({ error: "not found" }, 404)
      );
    }
    const artifactMatch = url.match(/^\/api\/visualiser\/artifacts\/(.+)$/);
    if (artifactMatch) {
      const filename = decodeURIComponent(artifactMatch[1]!);
      const found = snapshots[filename];
      return Promise.resolve(
        found ? jsonResponse(found) : jsonResponse({ error: "not found" }, 404)
      );
    }
    return Promise.resolve(jsonResponse({ error: "not found" }, 404));
  });
}

function run(
  id: string,
  seed: number,
  homeClubId: string,
  awayClubId: string,
  artefactId: string,
  score: { home: number; away: number }
) {
  return {
    id,
    seed,
    batchId: null,
    createdAt: "2026-05-02T12:00:00.000Z",
    homeClubId,
    awayClubId,
    homeTactics: defaultTactics(),
    awayTactics: defaultTactics(),
    artefactId,
    summary: {
      score,
      shots: { home: 9, away: 9 },
      fouls: { home: 3, away: 4 },
      cards: { home: 1, away: 2 },
      possession: { home: 50, away: 50 }
    }
  };
}

function snapshot(
  homeShortName: string,
  awayShortName: string,
  score: { home: number; away: number },
  attackingY: number
): MatchSnapshot {
  const ticks: MatchTick[] = [
    tick(0, [340, attackingY, 0], score),
    tick(1, [340, attackingY, 0], score)
  ];
  return {
    meta: {
      homeTeam: { id: homeShortName, name: homeShortName, shortName: homeShortName },
      awayTeam: { id: awayShortName, name: awayShortName, shortName: awayShortName },
      rosters: {
        home: [{ id: "h1", name: "Home Forward", shortName: "HF", position: "ST" }],
        away: [{ id: "a1", name: "Away Forward", shortName: "AF", position: "ST" }]
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
      finalScore: score,
      statistics: {
        home: {
          goals: score.home,
          shots: { total: 9, on: 4, off: 4, blocked: 1 },
          fouls: 3,
          yellowCards: 1,
          redCards: 0,
          corners: 1,
          possession: 50
        },
        away: {
          goals: score.away,
          shots: { total: 9, on: 4, off: 4, blocked: 1 },
          fouls: 4,
          yellowCards: 2,
          redCards: 0,
          corners: 2,
          possession: 50
        }
      }
    }
  };
}

function tick(
  iteration: number,
  ballPosition: [number, number, number],
  score: { home: number; away: number }
): MatchTick {
  return {
    iteration,
    matchClock: { half: 2, minute: 45, seconds: iteration * 3 },
    ball: { position: ballPosition, inFlight: false, carrierPlayerId: "h1" },
    players: [
      {
        id: "h1",
        teamId: "home",
        position: [ballPosition[0], ballPosition[1]],
        hasBall: true,
        onPitch: true
      },
      { id: "a1", teamId: "away", position: [340, 420], hasBall: false, onPitch: true }
    ],
    score,
    possession: { teamId: "home", zone: "att" },
    diagnostics: {
      shape: {
        home: shapeDiagnostics(11, 430),
        away: shapeDiagnostics(11, 380)
      }
    },
    events: [
      {
        type: "shot",
        team: "home",
        playerId: "h1",
        minute: 45,
        second: iteration * 3,
        detail: { onTarget: true, distanceBand: "edge" }
      }
    ]
  };
}

function shapeDiagnostics(activePlayers: number, teamLine: number) {
  return {
    activePlayers,
    lineHeight: {
      team: teamLine,
      defence: teamLine - 120,
      midfield: teamLine,
      attack: teamLine + 130
    },
    spread: {
      width: 320,
      depth: 450,
      compactness: 170
    },
    thirds: {
      defensive: 3,
      middle: 5,
      attacking: 3
    },
    oppositionHalfPlayers: 4,
    ballSidePlayers: 6
  };
}

function defaultTactics() {
  return {
    formation: "4-4-2",
    mentality: "balanced",
    tempo: "normal",
    pressing: "medium",
    lineHeight: "normal",
    width: "normal"
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response;
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
