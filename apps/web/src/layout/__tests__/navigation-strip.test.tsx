import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavigationStrip } from "../NavigationStrip";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("NavigationStrip", () => {
  it("renders stable navigation links and highlights the active route", async () => {
    vi.stubGlobal("fetch", mockNavigationFetch({ runCount: 2, batchId: "batch-1" }));

    render(
      <MemoryRouter initialEntries={["/visualise/run"]}>
        <NavigationStrip />
      </MemoryRouter>
    );

    expect(document.getElementById("nav-link-dashboard")?.getAttribute("href")).toBe("/");
    expect(document.getElementById("nav-link-sim-runner")?.getAttribute("href")).toBe(
      "/visualise/run"
    );
    expect(document.getElementById("nav-link-snapshot-replay")?.getAttribute("href")).toBe(
      "/visualise"
    );
    expect(document.getElementById("nav-link-compare")?.getAttribute("href")).toBe(
      "/visualise/compare"
    );
    expect(document.getElementById("nav-link-squad-manager")?.getAttribute("href")).toBe(
      "/admin/squad-manager"
    );
    expect(document.getElementById("nav-link-sim-runner")?.getAttribute("aria-current")).toBe(
      "page"
    );
    expect(document.getElementById("nav-link-sim-runner")?.className).toContain(
      "workbench-nav__link--active"
    );

    await waitFor(() =>
      expect(screen.getByText("Active dataset: FC26 PL20 import 2026-05-04")).toBeTruthy()
    );
  });

  it("disables compare when fewer than two runs exist", async () => {
    vi.stubGlobal("fetch", mockNavigationFetch({ runCount: 1 }));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <NavigationStrip />
      </MemoryRouter>
    );

    await waitFor(() => expect(document.getElementById("nav-link-compare")).toBeTruthy());
    const compareLink = document.getElementById("nav-link-compare");
    expect(compareLink?.getAttribute("aria-disabled")).toBe("true");
    expect(compareLink?.getAttribute("data-state")).toBe("disabled");
    expect(compareLink?.getAttribute("title")).toBe("Compare needs at least two persisted runs");
  });

  it("links to the latest batch when a recent batch exists", async () => {
    vi.stubGlobal("fetch", mockNavigationFetch({ runCount: 3, batchId: "batch-9" }));

    render(
      <MemoryRouter initialEntries={["/"]}>
        <NavigationStrip />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(document.getElementById("nav-link-latest-batch")?.getAttribute("href")).toBe(
        "/visualise/batch/batch-9"
      )
    );
    expect(document.getElementById("nav-link-latest-batch")?.getAttribute("data-batch-id")).toBe(
      "batch-9"
    );
  });
});

function mockNavigationFetch(options: { runCount: number; batchId?: string }) {
  return vi.fn((input: RequestInfo | URL): Promise<Response> => {
    const url = requestUrl(input);
    if (url === "/api/ai/squad-manager/context") {
      return Promise.resolve(
        jsonResponse({
          activeVersion: {
            id: "fc25-20260504102445-4399cb2b-a504ee92",
            name: "FC26 PL20 import 2026-05-04"
          },
          datasetVersions: [],
          clubs: []
        })
      );
    }
    if (url === "/api/match-engine/runs?page=1&limit=10") {
      const runs = Array.from({ length: options.runCount }, (_, index) =>
        run(`run-${index + 1}`, index === 0 ? (options.batchId ?? null) : null)
      );
      return Promise.resolve(jsonResponse({ runs, total: runs.length, page: 1, hasMore: false }));
    }
    return Promise.resolve(jsonResponse({ error: "not found" }, 404));
  });
}

function run(id: string, batchId: string | null) {
  return {
    id,
    seed: 10,
    batchId,
    createdAt: "2026-05-05T08:36:00.000Z",
    homeClubId: "liverpool",
    awayClubId: "manchester-city",
    homeTactics: defaultTactics(),
    awayTactics: defaultTactics(),
    artefactId: `${id}.json`,
    summary: {
      score: { home: 1, away: 0 },
      shots: { home: 10, away: 9 },
      fouls: { home: 8, away: 9 },
      cards: { home: 1, away: 2 },
      possession: { home: 50, away: 50 }
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
