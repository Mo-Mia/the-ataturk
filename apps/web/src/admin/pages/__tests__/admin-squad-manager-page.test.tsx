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
      if (url === "/api/admin/squad-manager/apply") {
        const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
        expect(body).toMatchObject({
          clubId: "liverpool",
          datasetVersionId: "fc25-base",
          riskLevel: "low",
          suggestions: [verification.verification.suggestions[0]]
        });
        return Promise.resolve(
          jsonResponse({
            newDatasetVersionId: "fc25-next",
            activated: false,
            idempotent: false,
            summary: { applied: 1, updated: 1, added: 0, removed: 0 },
            audit: {
              kind: "squad-manager-apply",
              schemaVersion: 1,
              sourceDatasetVersionId: "fc25-base",
              clubId: "liverpool",
              riskLevel: "low",
              suggestionIds: ["sug-low-1"],
              suggestions: [verification.verification.suggestions[0]],
              payloadHash: "abc",
              appliedAt: "2026-05-05T00:00:00.000Z",
              actor: "squad-manager-ui",
              verifyFresh: false
            }
          })
        );
      }
      if (url === "/api/admin/squad-manager/dataset-versions/fc25-base/activate") {
        return Promise.resolve(jsonResponse(version));
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
    fireEvent.click(screen.getByLabelText("Review mode"));
    fireEvent.click(screen.getByRole("button", { name: "Apply low" }));
    expect(
      screen.getByText(/will create a new inactive dataset version from fc25-base/)
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/squad-manager/apply", expect.any(Object))
    );
    expect(await screen.findByText(/Created inactive dataset version fc25-next/)).not.toBeNull();
  });

  it("defaults to review mode and guards apply until review mode is disabled", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
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
      if (url === "/api/admin/squad-manager/apply") {
        return Promise.reject(new Error("apply should stay guarded"));
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    await waitFor(() => expect(screen.getAllByText("Mohamed Salah").length).toBeGreaterThan(0));
    const reviewToggle = document.querySelector<HTMLInputElement>(
      '[data-uat="squad-manager-review-mode-toggle"]'
    );
    const lowApplyButton = () =>
      document.querySelector<HTMLButtonElement>(
        '[data-uat="squad-manager-apply-button"][data-risk-level="low"]'
      );
    const applyGuard = document.querySelector<HTMLElement>(
      '[data-uat="squad-manager-apply-guard"]'
    );

    expect(reviewToggle?.checked).toBe(true);
    expect(applyGuard?.dataset.reviewMode).toBe("on");

    fireEvent.click(screen.getByRole("button", { name: "Verify squad" }));
    await screen.findByText("Add New Forward");

    expect(lowApplyButton()?.disabled).toBe(true);
    expect(lowApplyButton()?.dataset.reviewMode).toBe("on");
    expect(lowApplyButton()?.dataset.applyAvailable).toBe("false");
    expect(screen.queryByText(/will create a new inactive dataset version/)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/squad-manager/apply",
      expect.any(Object)
    );

    fireEvent.click(screen.getByLabelText("Review mode"));

    expect(reviewToggle?.checked).toBe(false);
    expect(lowApplyButton()?.disabled).toBe(false);
    expect(lowApplyButton()?.dataset.reviewMode).toBe("off");
    expect(lowApplyButton()?.dataset.applyAvailable).toBe("true");
    expect(
      document.querySelector<HTMLButtonElement>(
        '[data-uat="squad-manager-apply-button"][data-risk-level="high"]'
      )?.disabled
    ).toBe(true);
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
    suggestions: [
      {
        suggestionId: "sug-low-1",
        type: "player_update",
        playerId: "salah",
        changes: {
          nationality: "Egypt"
        },
        rationale: "Low-risk nationality correction."
      }
    ],
    attributeWarnings: []
  }
};
