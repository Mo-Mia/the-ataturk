import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BatchDistributionPage } from "../BatchDistributionPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BatchDistributionPage", () => {
  it("renders histograms, summary stats, and opens a representative run from a bucket", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ runs: createRuns() }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/visualise/batch/batch-1"]}>
        <Routes>
          <Route path="/visualise/batch/:batchId" element={<BatchDistributionPage />} />
          <Route path="/visualise" element={<p>Replay opened</p>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/liverpool vs manchester-city/)).toBeTruthy());
    expect(screen.getByText(/seeds 10-12/)).toBeTruthy();
    expect(screen.getByLabelText("Batch summary statistics")).toBeTruthy();
    expect(screen.getByLabelText("Home goals histogram")).toBeTruthy();
    expect(within(screen.getByLabelText("Batch summary statistics")).getByText("Mean")).toBeTruthy();
    expect(screen.getByText("1.3")).toBeTruthy();

    const firstBar = document.querySelector(".recharts-bar-rectangle");
    expect(firstBar).toBeTruthy();
    fireEvent.click(firstBar!);

    expect(await screen.findByText("Replay opened")).toBeTruthy();
  });

  it("shows a clean error state for an unknown batch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404)));

    render(
      <MemoryRouter initialEntries={["/visualise/batch/missing"]}>
        <Routes>
          <Route path="/visualise/batch/:batchId" element={<BatchDistributionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Batch request failed with 404")).toBeTruthy();
  });
});

function createRuns() {
  return [
    run("run-10", 10, "artifact-10.json", { home: 1, away: 3 }, 47),
    run("run-11", 11, "artifact-11.json", { home: 2, away: 3 }, 51),
    run("run-12", 12, "artifact-12.json", { home: 1, away: 4 }, 55)
  ];
}

function run(
  id: string,
  seed: number,
  artefactId: string,
  score: { home: number; away: number },
  homePossession: number
) {
  return {
    id,
    seed,
    batchId: "batch-1",
    createdAt: "2026-05-02T12:00:00.000Z",
    homeClubId: "liverpool",
    awayClubId: "manchester-city",
    homeTactics: defaultTactics(),
    awayTactics: defaultTactics(),
    artefactId,
    summary: {
      score,
      shots: { home: 8 + (seed % 3), away: 6 },
      fouls: { home: 3, away: 4 },
      cards: { home: 1, away: 1 },
      possession: { home: homePossession, away: 100 - homePossession }
    }
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
