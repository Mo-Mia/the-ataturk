import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "../DashboardPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DashboardPage", () => {
  it("renders populated widgets with stable UAT data and click-through links", async () => {
    vi.stubGlobal("fetch", mockDashboardFetch({ mode: "populated" }));

    renderDashboard();

    expect(await screen.findByText("FC26 PL20 import 2026-05-04")).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector("[data-uat='active-dataset-player-count']")?.textContent).toBe(
        "3"
      )
    );
    expect(screen.getAllByText("liverpool 2-1 manchester-city")).toHaveLength(2);
    expect(await screen.findByText("batch-1")).toBeTruthy();
    expect(screen.getByText("Phase 14b/17, real-PL anchored, FC26 PL20.")).toBeTruthy();
    expect(screen.getByText("ok")).toBeTruthy();

    const datasetWidget = screen.getByLabelText("Active dataset");
    expect(
      within(datasetWidget).getByRole("link", { name: "Open Squad Manager" }).getAttribute("href")
    ).toBe("/admin/squad-manager");
    expect(
      screen.getAllByRole("link", { name: /liverpool 2-1 manchester-city/ })[0]?.getAttribute("href")
    ).toBe("/visualise?artifact=artifact-1.json");
    expect(screen.getByRole("link", { name: "Open Batch" }).getAttribute("href")).toBe(
      "/visualise/batch/batch-1"
    );
    expect(screen.getByRole("link", { name: "Open Baseline Doc" }).getAttribute("href")).toBe(
      "https://github.com/Mo-Mia/the-ataturk/blob/main/docs/CALIBRATION_BASELINE_PHASE_14.md"
    );
    expect(screen.getByRole("link", { name: "Smoke Test" }).getAttribute("href")).toBe(
      "/smoke-test"
    );

    const cardsMetric = document.querySelector("[data-metric='cards']");
    expect(cardsMetric?.getAttribute("data-value")).toBe("5.1");
    expect(cardsMetric?.getAttribute("data-status")).toBe("in-band");
  });

  it("navigates through a dashboard entity link", async () => {
    vi.stubGlobal("fetch", mockDashboardFetch({ mode: "populated" }));

    renderDashboard();

    const recentRun = (await screen.findAllByRole("link", {
      name: /liverpool 2-1 manchester-city/
    }))[0]!;
    fireEvent.click(recentRun);

    expect(await screen.findByText("Replay opened")).toBeTruthy();
  });

  it("renders clean empty states for a fresh install", async () => {
    vi.stubGlobal("fetch", mockDashboardFetch({ mode: "empty" }));

    renderDashboard();

    expect(await screen.findByText("No active FC dataset found.")).toBeTruthy();
    expect(screen.getByText("No persisted runs yet.")).toBeTruthy();
    expect(screen.getByText("No recent batches.")).toBeTruthy();
    expect(screen.getByText("No runs yet")).toBeTruthy();
  });
});

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/visualise" element={<p>Replay opened</p>} />
        <Route path="/visualise/batch/:batchId" element={<p>Batch opened</p>} />
        <Route path="/admin/squad-manager" element={<p>Squad manager opened</p>} />
        <Route path="/smoke-test" element={<p>Smoke test opened</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function mockDashboardFetch(options: { mode: "populated" | "empty" }) {
  return vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = requestUrl(input);
    if (url === "/api/ai/squad-manager/context") {
      if (options.mode === "empty") {
        return Promise.resolve(jsonResponse({ activeVersion: null, datasetVersions: [], clubs: [] }));
      }
      return Promise.resolve(
        jsonResponse({
          activeVersion: {
            id: "fc25-20260504102445-4399cb2b-a504ee92",
            name: "FC26 PL20 import 2026-05-04",
            source_file: "data/fc-25/FC26_20250921.csv",
            source_file_sha256: "abc123",
            description: "Premier League 20",
            is_active: true,
            created_at: "2026-05-04T10:24:45.000Z",
            updated_at: "2026-05-04T10:24:45.000Z"
          },
          datasetVersions: [],
          clubs: [
            { id: "liverpool", name: "Liverpool", short_name: "LIV" },
            { id: "manchester-city", name: "Manchester City", short_name: "MCI" }
          ]
        })
      );
    }
    if (url.startsWith("/api/ai/squad-manager/squad?")) {
      const params = new URLSearchParams(url.split("?")[1]);
      return Promise.resolve(
        jsonResponse({
          squad: params.get("clubId") === "liverpool" ? [{ id: "p1" }, { id: "p2" }] : [{ id: "p3" }]
        })
      );
    }
    if (url === "/api/match-engine/runs?page=1&limit=10") {
      const runs = options.mode === "empty" ? [] : [run("run-1", 10, "batch-1"), run("run-2", 11, null)];
      return Promise.resolve(jsonResponse({ runs, total: runs.length, page: 1, hasMore: false }));
    }
    if (url === "/api/match-engine/batches/batch-1/runs") {
      return Promise.resolve(jsonResponse({ runs: [run("run-1", 10, "batch-1"), run("run-3", 12, "batch-1")] }));
    }
    if (url === "/api/health") {
      return Promise.resolve(jsonResponse({ status: "ok", timestamp: "2026-05-05T08:36:00.000Z" }));
    }
    return Promise.resolve(jsonResponse({ error: "not found" }, 404));
  });
}

function run(id: string, seed: number, batchId: string | null) {
  return {
    id,
    seed,
    batchId,
    createdAt: "2026-05-05T08:36:00.000Z",
    homeClubId: "liverpool",
    awayClubId: "manchester-city",
    homeTactics: defaultTactics(),
    awayTactics: defaultTactics(),
    artefactId: `artifact-${id.split("-")[1]}.json`,
    summary: {
      score: { home: 2, away: 1 },
      shots: { home: 12, away: 11 },
      fouls: { home: 8, away: 9 },
      cards: { home: 2, away: 1 },
      possession: { home: 51, away: 49 }
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

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response;
}
