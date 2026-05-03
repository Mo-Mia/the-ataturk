import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SimRunnerPage } from "../SimRunnerPage";

const clubs = [
  { id: "liverpool", name: "Liverpool", short_name: "LIV" },
  { id: "manchester-city", name: "Manchester City", short_name: "MCI" },
  { id: "arsenal", name: "Arsenal", short_name: "ARS" }
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SimRunnerPage", () => {
  it("loads clubs, submits a run, and renders a replay result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(clubs))
      .mockResolvedValueOnce(jsonResponse(runList([])))
      .mockResolvedValueOnce(jsonResponse(squadResponse("liverpool", "home")))
      .mockResolvedValueOnce(jsonResponse(squadResponse("manchester-city", "away")))
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: "run-42",
              seed: 42,
              batchId: null,
              createdAt: "2026-05-02T12:00:00.000Z",
              homeClubId: "liverpool",
              awayClubId: "manchester-city",
              homeTactics: defaultTactics(),
              awayTactics: defaultTactics(),
              artefactId: "match-engine-20260502120000-liv-mci-seed-42-deadbeef.json",
              summary: {
                score: { home: 1, away: 2 },
                shots: { home: 9, away: 7 },
                fouls: { home: 4, away: 5 },
                cards: { home: 1, away: 2 },
                possession: { home: 49, away: 51 },
                duration: "full_90"
              }
            }
          ],
          errors: []
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SimRunnerPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Run simulation" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/match-engine/simulate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home: {
            clubId: "liverpool",
            tactics: {
              formation: "4-4-2",
              mentality: "balanced",
              tempo: "normal",
              pressing: "medium",
              lineHeight: "normal",
              width: "normal"
            }
          },
          away: {
            clubId: "manchester-city",
            tactics: {
              formation: "4-4-2",
              mentality: "balanced",
              tempo: "normal",
              pressing: "medium",
              lineHeight: "normal",
              width: "normal"
            }
          },
          seed: 42,
          batch: 1,
          duration: "full_90"
        })
      })
    );

    const history = screen.getByLabelText("Run history");
    expect(within(history).getByText("1-2")).toBeTruthy();
    expect(within(history).getByText("Full match")).toBeTruthy();
    expect(within(history).getByText("9/7")).toBeTruthy();
    expect(within(history).getByText("49%/51%")).toBeTruthy();
    expect(within(history).getByRole("link", { name: "Replay" }).getAttribute("href")).toBe(
      "/visualise?artifact=match-engine-20260502120000-liv-mci-seed-42-deadbeef.json"
    );
    expect(within(history).getByRole("link", { name: "Compare" }).getAttribute("href")).toBe(
      "/visualise/compare?a=run-42"
    );
  });

  it("submits second-half duration and expands recorded XI details", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(clubs))
      .mockResolvedValueOnce(jsonResponse(runList([])))
      .mockResolvedValueOnce(jsonResponse(squadResponse("liverpool", "home")))
      .mockResolvedValueOnce(jsonResponse(squadResponse("manchester-city", "away")))
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: "run-xi",
              seed: 52,
              batchId: null,
              createdAt: "2026-05-02T12:00:00.000Z",
              homeClubId: "liverpool",
              awayClubId: "manchester-city",
              homeTactics: defaultTactics(),
              awayTactics: defaultTactics(),
              artefactId: "match-engine-xi.json",
              summary: {
                score: { home: 0, away: 0 },
                shots: { home: 1, away: 1 },
                fouls: { home: 0, away: 0 },
                cards: { home: 0, away: 0 },
                possession: { home: 50, away: 50 },
                duration: "second_half",
                xi: {
                  home: [lineupPlayer("h1", "ST", "Jota")],
                  away: [lineupPlayer("a1", "GK", "Ederson")]
                }
              }
            }
          ],
          errors: []
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SimRunnerPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.change(screen.getByLabelText("Match duration"), { target: { value: "second_half" } });
    fireEvent.click(screen.getByRole("button", { name: "Run simulation" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/match-engine/simulate");
    const requestInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    if (typeof requestInit.body !== "string") {
      throw new Error("Expected JSON request body");
    }
    expect(requestInit.body).toContain('"duration":"second_half"');

    fireEvent.click(screen.getByRole("button", { name: "Show XI" }));
    expect(screen.getByText("Home XI")).toBeTruthy();
    expect(screen.getByText("ST · Jota")).toBeTruthy();
    expect(screen.getByText("GK · Ederson")).toBeTruthy();
  });

  it("renders an empty dataset message when no FC25 clubs are active", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse(runList([])))
    );

    render(<SimRunnerPage />);

    expect(
      await screen.findByText("No active FC25 dataset found. Import FC25 data first.")
    ).toBeTruthy();
  });

  it("renders partial batch errors alongside successful rows", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(clubs))
      .mockResolvedValueOnce(jsonResponse(runList([])))
      .mockResolvedValueOnce(jsonResponse(squadResponse("liverpool", "home")))
      .mockResolvedValueOnce(jsonResponse(squadResponse("manchester-city", "away")))
      .mockResolvedValueOnce(
        jsonResponse({
          runs: [
            {
              id: "run-50",
              seed: 50,
              batchId: "batch-1",
              createdAt: "2026-05-02T12:00:00.000Z",
              homeClubId: "liverpool",
              awayClubId: "manchester-city",
              homeTactics: defaultTactics(),
              awayTactics: defaultTactics(),
              artefactId: "match-engine-20260502120000-liv-mci-seed-50-feedface.json",
              summary: {
                score: { home: 2, away: 1 },
                shots: { home: 10, away: 8 },
                fouls: { home: 3, away: 4 },
                cards: { home: 1, away: 1 },
                possession: { home: 52, away: 48 }
              }
            }
          ],
          errors: [{ seed: 51, error: "Synthetic run failure" }]
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<SimRunnerPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    fireEvent.change(screen.getByLabelText("Seed"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Batch"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Run simulation" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(screen.getByText("2-1")).toBeTruthy();
    expect(screen.getByText("Seed 51: Synthetic run failure")).toBeTruthy();
  });

  it("submits manual starting ids after auto-filling the remainder", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(clubs))
      .mockResolvedValueOnce(jsonResponse(runList([])))
      .mockResolvedValueOnce(jsonResponse(squadResponse("liverpool", "home")))
      .mockResolvedValueOnce(jsonResponse(squadResponse("manchester-city", "away")))
      .mockResolvedValueOnce(jsonResponse({ runs: [], errors: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<SimRunnerPage />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    const homeSquad = screen.getByLabelText("Home squad");
    fireEvent.click(within(homeSquad).getByLabelText(/Home 2/));
    expect(screen.getByText("10 / 11 selected · Manual XI")).toBeTruthy();
    fireEvent.click(within(homeSquad).getByRole("button", { name: "Auto-fill remainder" }));
    expect(screen.getByText("11 / 11 selected · Manual XI")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Run simulation" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    const requestInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    if (typeof requestInit.body !== "string") {
      throw new Error("Expected JSON request body");
    }
    expect(requestInit.body).toContain('"startingPlayerIds"');
    expect(requestInit.body).toContain('"home-2"');
  });
});

function runList(runs: unknown[]) {
  return { runs, total: runs.length, page: 1, hasMore: false };
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

function lineupPlayer(id: string, position: string, shortName: string) {
  return {
    id,
    name: shortName,
    shortName,
    position
  };
}

function squadResponse(clubId: string, prefix: "home" | "away") {
  const roles = ["GK", "RB", "CB", "CB", "LB", "RM", "CM", "CM", "LM", "ST", "ST"];
  const squad = Array.from({ length: 18 }, (_, index) => {
    const number = index + 1;
    const role = roles[index] ?? (index % 2 === 0 ? "CM" : "ST");
    return {
      id: `${prefix}-${number}`,
      name: `${title(prefix)} ${number}`,
      shortName: `${title(prefix)} ${number}`,
      squadNumber: number,
      overall: 90 - index,
      position: role,
      sourcePosition: role,
      alternativePositions: [],
      preferredFoot: "right",
      weakFootRating: 3
    };
  });
  const autoXi = squad.slice(0, 11).map((player) => lineupPlayer(player.id, player.position, player.shortName));
  const bench = squad.slice(11, 18).map((player) => lineupPlayer(player.id, player.position, player.shortName));

  return {
    clubId,
    formation: "4-4-2",
    roles,
    squad,
    autoXi,
    bench,
    assignments: [],
    warnings: []
  };
}

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  } as Response;
}
