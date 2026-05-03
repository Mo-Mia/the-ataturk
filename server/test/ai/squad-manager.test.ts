import { getDb, importFc25Dataset } from "@the-ataturk/data";
import { afterEach, describe, expect, it, vi } from "vitest";

const genAiMocks = vi.hoisted(() => ({
  generateContent: vi.fn<
    (request: {
      config: {
        systemInstruction: string;
        thinkingConfig?: { thinkingBudget?: number };
      };
    }) => Promise<{ text: string }>
  >()
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: genAiMocks.generateContent
    };
  }
}));

import { buildApp } from "../../src/app";
import {
  DATA_VERACITY_RECONCILER_PROMPT,
  FOOTBALL_DATA_TEAMS,
  createSlidingWindowRateLimitGate,
  resetAiRouteStateForTests,
  setFootballDataCurlFallbackRunnerForTests,
  setGeminiCurlFallbackRunnerForTests
} from "../../src/routes/ai";
import { createServerTestDatabase, type TestDatabase } from "../admin/test-db";

const previousFootballDataApiKey = process.env.FOOTBALL_DATA_API_KEY;
const previousGeminiApiKey = process.env.GEMINI_API_KEY;
const FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";

let testDatabase: TestDatabase | undefined;

interface VerifySquadTestResponse {
  cacheStatus: string;
  verification: {
    missingPlayers: Array<{
      suggestionId: string;
      type: string;
      livePlayer: {
        id: number;
      };
    }>;
  };
}

interface ErrorResponse {
  error: string;
}

afterEach(() => {
  vi.unstubAllGlobals();
  genAiMocks.generateContent.mockReset();
  resetAiRouteStateForTests();
  testDatabase?.cleanup();
  testDatabase = undefined;

  if (previousFootballDataApiKey === undefined) {
    delete process.env.FOOTBALL_DATA_API_KEY;
  } else {
    process.env.FOOTBALL_DATA_API_KEY = previousFootballDataApiKey;
  }

  if (previousGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = previousGeminiApiKey;
  }
});

describe("AI squad manager routes", () => {
  it("verifies a squad, generates suggestion ids, caches live team responses, and applies issued suggestions", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: FOOTBALL_DATA_TEAMS.liverpool.footballDataTeamId,
        name: "Liverpool FC",
        squad: [
          {
            id: 999001,
            name: "New Forward",
            position: "Forward",
            dateOfBirth: "2000-01-01",
            nationality: "England",
            shirtNumber: 99
          }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [
          {
            type: "player_addition",
            livePlayerId: 999001,
            rationale: "Live squad includes a new forward."
          }
        ],
        suggestions: [],
        attributeWarnings: []
      })
    });
    const app = buildApp();

    try {
      const verify = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });

      expect(verify.statusCode).toBe(200);
      const body = verify.json<VerifySquadTestResponse>();
      const missingPlayer = body.verification.missingPlayers[0];
      expect(missingPlayer).toBeDefined();
      expect(body.cacheStatus).toBe("miss");
      expect(missingPlayer!.suggestionId).toMatch(/^sug-/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.football-data.org/v4/teams/64");
      expect(genAiMocks.generateContent.mock.calls[0]?.[0].config.systemInstruction).toBe(
        DATA_VERACITY_RECONCILER_PROMPT
      );
      expect(genAiMocks.generateContent.mock.calls[0]?.[0].config).toMatchObject({
        thinkingConfig: { thinkingBudget: 1024 }
      });

      const cached = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });
      expect(cached.json<VerifySquadTestResponse>().cacheStatus).toBe("hit");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const apply = await app.inject({
        method: "POST",
        url: "/api/ai/apply-suggestions",
        payload: {
          clubId: "liverpool",
          baseDatasetVersionId: "fc25-base",
          suggestions: [missingPlayer!],
          rationale: "Accepted from test"
        }
      });

      expect(apply.statusCode).toBe(200);
      expect(apply.json()).toMatchObject({ activated: true, summary: { applied: 1, added: 1 } });
      expect(
        getDb(testDatabase.path)
          .prepare<
            [],
            { count: number }
          >("SELECT COUNT(*) AS count FROM fc25_players WHERE id = 'fd-999001'")
          .get()?.count
      ).toBe(1);
    } finally {
      await app.close();
    }
  });

  it("rejects malformed Gemini output without crashing", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-malformed");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          id: 64,
          name: "Liverpool FC",
          squad: []
        })
      )
    );
    genAiMocks.generateContent.mockResolvedValue({ text: "not-json" });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });

      expect(response.statusCode).toBe(502);
      expect(response.json<ErrorResponse>().error).toContain("invalid JSON");
    } finally {
      await app.close();
    }
  });

  it("accepts nullable optional football-data.org squad fields", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-null-live-fields");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          id: 64,
          name: "Liverpool FC",
          squad: [
            {
              id: 999002,
              name: "Nullable Midfielder",
              position: null,
              dateOfBirth: null,
              nationality: null,
              shirtNumber: null
            }
          ]
        })
      )
    );
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: []
      })
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<VerifySquadTestResponse>().cacheStatus).toBe("miss");
    } finally {
      await app.close();
    }
  });

  it("falls back to Gemini REST via curl when the SDK transport cannot resolve DNS", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-gemini-curl-fallback");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          id: 64,
          name: "Liverpool FC",
          squad: []
        })
      )
    );
    const transportError = new TypeError("fetch failed", {
      cause: Object.assign(new Error("getaddrinfo ENOTFOUND generativelanguage.googleapis.com"), {
        code: "ENOTFOUND"
      })
    });
    genAiMocks.generateContent.mockRejectedValue(transportError);
    const fallback = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: []
      })
    });
    setGeminiCurlFallbackRunnerForTests(fallback);
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });

      expect(response.statusCode).toBe(200);
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(response.json<VerifySquadTestResponse>().cacheStatus).toBe("miss");
    } finally {
      await app.close();
    }
  });

  it("falls back to Gemini REST via curl when the SDK rejects an otherwise valid request", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-gemini-sdk-bad-request-fallback");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          id: 64,
          name: "Liverpool FC",
          squad: []
        })
      )
    );
    genAiMocks.generateContent.mockRejectedValue(
      new Error("Non-retryable exception Bad Request sending request")
    );
    const fallback = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: []
      })
    });
    setGeminiCurlFallbackRunnerForTests(fallback);
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });

      expect(response.statusCode).toBe(200);
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(response.json<VerifySquadTestResponse>().cacheStatus).toBe("miss");
    } finally {
      await app.close();
    }
  });

  it("falls back to football-data.org via curl when Node fetch cannot resolve DNS", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-football-data-curl-fallback");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(
        new TypeError("fetch failed", {
          cause: Object.assign(new Error("getaddrinfo ENOTFOUND api.football-data.org"), {
            code: "ENOTFOUND"
          })
        })
      )
    );
    const fallback = vi.fn().mockResolvedValue({
      id: 64,
      name: "Liverpool FC",
      squad: []
    });
    setFootballDataCurlFallbackRunnerForTests(fallback);
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: []
      })
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/ai/verify-squad",
        payload: { clubId: "liverpool", datasetVersionId: "fc25-base" }
      });

      expect(response.statusCode).toBe(200);
      expect(fallback).toHaveBeenCalledWith("football-data-key", 64);
      expect(response.json<VerifySquadTestResponse>().cacheStatus).toBe("miss");
    } finally {
      await app.close();
    }
  });

  it("rejects apply requests with unissued suggestion ids", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-forgery");
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/ai/apply-suggestions",
        payload: {
          clubId: "liverpool",
          baseDatasetVersionId: "fc25-base",
          suggestions: [
            {
              suggestionId: "sug-forged",
              type: "player_addition",
              livePlayer: {
                id: 999001,
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
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<ErrorResponse>().error).toContain("was not issued by this server");
    } finally {
      await app.close();
    }
  });
});

describe("football-data.org sliding-window rate gate", () => {
  it("enforces minute and day windows independently", () => {
    const gate = createSlidingWindowRateLimitGate({
      minuteLimit: 2,
      dayLimit: 3,
      minuteWindowMs: 1_000,
      dayWindowMs: 10_000
    });

    expect(gate.attempt(0).allowed).toBe(true);
    expect(gate.attempt(100).allowed).toBe(true);
    expect(gate.attempt(200)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(gate.attempt(1_100).allowed).toBe(true);
    expect(gate.attempt(1_200)).toMatchObject({ allowed: false });
    expect(gate.attempt(10_200).allowed).toBe(true);
  });
});

function createFc25ServerDatabase(prefix: string): TestDatabase {
  const database = createServerTestDatabase(prefix);
  importFc25Dataset({
    databasePath: database.path,
    csvPath: FIXTURE_PATH,
    datasetVersionId: "fc25-base",
    name: "FC25 base",
    now: new Date("2026-05-03T09:00:00.000Z")
  });
  return database;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...init.headers },
    ...init
  });
}
