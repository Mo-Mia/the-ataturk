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
    updated_at: "2026-05-03T00:00:00.000Z"
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
    updated_at: "2026-05-03T00:00:00.000Z"
  }
];

const squad = [
  {
    id: "salah",
    name: "Mohamed Salah",
    shortName: "M. Salah",
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
