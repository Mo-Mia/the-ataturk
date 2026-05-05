import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminSquadManagerPage } from "../AdminSquadManagerPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminSquadManagerPage", () => {
  it("renders verification results and applies accepted suggestions", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url === "/api/ai/squad-manager/context") {
        return Promise.resolve(
          jsonResponse({
            activeVersion: version,
            datasetVersions: [version],
            clubs
          })
        );
      }
      if (url.startsWith("/api/ai/squad-manager/squad")) {
        return Promise.resolve(jsonResponse({ squad }));
      }
      if (url === "/api/ai/verify-squad") {
        return Promise.resolve(jsonResponse(verification));
      }
      if (url === "/api/ai/apply-suggestions") {
        const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
        expect(body).toMatchObject({
          clubId: "liverpool",
          baseDatasetVersionId: "fc25-base",
          suggestions: [verification.verification.missingPlayers[0]]
        });
        return Promise.resolve(
          jsonResponse({
            newDatasetVersionId: "fc25-next",
            activated: true,
            summary: { applied: 1, updated: 0, added: 1, removed: 0 }
          })
        );
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    await waitFor(() => expect(screen.getAllByText("Mohamed Salah").length).toBeGreaterThan(0));
    const status = document.querySelector<HTMLElement>(
      '[data-uat="squad-manager-football-data-status"]'
    );
    expect(status?.dataset.footballDataTeamId).toBe("64");
    expect(status?.dataset.footballDataName).toBe("Liverpool FC");
    fireEvent.click(screen.getByRole("button", { name: "Verify squad" }));
    await screen.findByText("Add New Forward");
    fireEvent.click(screen.getByLabelText(/Add New Forward/));
    fireEvent.click(screen.getByRole("button", { name: "Apply accepted" }));
    expect(screen.getByText(/fc25-base via squad-manager/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/ai/apply-suggestions", expect.any(Object))
    );
  });

  it("exposes a mapped football-data.org status for newly supported PL20 clubs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/api/ai/squad-manager/context") {
          return Promise.resolve(
            jsonResponse({
              activeVersion: version,
              datasetVersions: [version],
              clubs
            })
          );
        }
        if (url.startsWith("/api/ai/squad-manager/squad")) {
          return Promise.resolve(jsonResponse({ squad }));
        }
        return Promise.reject(new Error(`Unexpected fetch ${url}`));
      })
    );

    renderPage();

    await waitFor(() => expect(screen.getAllByText("Mohamed Salah").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText("Away club"), { target: { value: "sunderland" } });
    fireEvent.change(screen.getByLabelText("Verify"), { target: { value: "sunderland" } });

    const status = document.querySelector<HTMLElement>(
      '[data-uat="squad-manager-football-data-status"]'
    );
    expect(status?.dataset.footballDataState).toBe("mapped");
    expect(status?.dataset.footballDataTeamId).toBe("71");
    expect(status?.textContent).toContain("Sunderland AFC");
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSquadManagerPage />
    </QueryClientProvider>
  );
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

const version = {
  id: "fc25-base",
  name: "FC25 base",
  source_file: "fixture.csv",
  source_file_sha256: "abc",
  description: null,
  is_active: true,
  created_at: "2026-05-03T00:00:00.000Z",
  updated_at: "2026-05-03T00:00:00.000Z"
};

const clubs = [
  {
    dataset_version_id: "fc25-base",
    id: "liverpool",
    name: "Liverpool",
    short_name: "LIV",
    country: "England",
    league: "Premier League",
    fc25_team_id: "Liverpool",
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    footballData: {
      footballDataTeamId: 64,
      footballDataName: "Liverpool FC"
    }
  },
  {
    dataset_version_id: "fc25-base",
    id: "sunderland",
    name: "Sunderland",
    short_name: "SUN",
    country: "England",
    league: "Premier League",
    fc25_team_id: "Sunderland",
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    footballData: {
      footballDataTeamId: 71,
      footballDataName: "Sunderland AFC"
    }
  },
  {
    dataset_version_id: "fc25-base",
    id: "manchester-city",
    name: "Manchester City",
    short_name: "MCI",
    country: "England",
    league: "Premier League",
    fc25_team_id: "Manchester City",
    created_at: "2026-05-03T00:00:00.000Z",
    updated_at: "2026-05-03T00:00:00.000Z",
    footballData: {
      footballDataTeamId: 65,
      footballDataName: "Manchester City FC"
    }
  }
];

const squad = [
  {
    id: "salah",
    name: "Mohamed Salah",
    shortName: "M. Salah",
    displayName: "Mohamed Salah",
    sourceName: "Mohamed Salah Hamed Ghalyمحمد صلاح",
    sourceShortName: "M. Salah",
    squadNumber: 11,
    position: "RW",
    age: 33,
    overall: 89,
    sourcePosition: "RW",
    alternativePositions: ["RM"]
  }
];

const verification = {
  cacheStatus: "miss",
  apiQuotaRemaining: { minute: 9, day: 99 },
  verification: {
    missingPlayers: [
      {
        suggestionId: "sug-1",
        type: "player_addition",
        livePlayer: {
          id: 1,
          name: "New Forward",
          position: "Forward",
          nationality: "England"
        },
        proposed: {
          name: "New Forward",
          position: "ST",
          nationality: "England",
          age: 26
        }
      }
    ],
    suggestions: [],
    attributeWarnings: []
  }
};
