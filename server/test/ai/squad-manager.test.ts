import { FC25_CLUB_IDS, importFc25Dataset } from "@the-ataturk/data";
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
const FC26_PL20_FIXTURE_PATH = "data/fc-25/FC26_20250921.csv";

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
    attributeWarnings: Array<{
      suggestionId: string;
      type: string;
      playerId: string;
      changes: {
        age?: number;
      };
    }>;
  };
}

interface ErrorResponse {
  error: string;
}

interface SquadManagerContextResponse {
  clubs: Array<{
    id: string;
    footballData?: {
      footballDataTeamId: number;
      footballDataName: string;
    };
  }>;
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
  it("maps every FC26 PL20 club to a unique football-data.org team", () => {
    expect(Object.keys(FOOTBALL_DATA_TEAMS).sort()).toEqual([...FC25_CLUB_IDS].sort());
    expect(
      new Set(Object.values(FOOTBALL_DATA_TEAMS).map((mapping) => mapping.footballDataTeamId)).size
    ).toBe(FC25_CLUB_IDS.length);
    expect(FOOTBALL_DATA_TEAMS.sunderland).toEqual({
      footballDataTeamId: 71,
      footballDataName: "Sunderland AFC"
    });
  });

  it("exposes football-data.org mappings for every active PL20 club in context", async () => {
    testDatabase = createFc26Pl20ServerDatabase("ai-squad-manager-pl20-context");
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/ai/squad-manager/context"
      });

      expect(response.statusCode).toBe(200);
      const clubs = response.json<SquadManagerContextResponse>().clubs;
      expect(clubs).toHaveLength(20);
      expect(clubs.every((club) => club.footballData)).toBe(true);
      expect(clubs.find((club) => club.id === "afc-bournemouth")?.footballData).toEqual({
        footballDataTeamId: 1044,
        footballDataName: "AFC Bournemouth"
      });
    } finally {
      await app.close();
    }
  }, 15_000);

  it("verifies every PL20 club with mocked football-data.org and Gemini responses", async () => {
    testDatabase = createFc26Pl20ServerDatabase("ai-squad-manager-pl20-verify");
    process.env.FOOTBALL_DATA_API_KEY = "football-data-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const teamId = Number.parseInt(url.split("/").at(-1) ?? "", 10);
      const mapping = Object.values(FOOTBALL_DATA_TEAMS).find(
        (candidate) => candidate.footballDataTeamId === teamId
      );
      return Promise.resolve(
        jsonResponse({
          id: teamId,
          name: mapping?.footballDataName ?? `Team ${teamId}`,
          squad: []
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: []
      })
    });
    const app = buildApp();

    try {
      for (const clubId of FC25_CLUB_IDS) {
        resetAiRouteStateForTests();
        const response = await app.inject({
          method: "POST",
          url: "/api/ai/verify-squad",
          payload: { clubId, datasetVersionId: "fc26-pl20-base" }
        });

        expect(response.statusCode, clubId).toBe(200);
        expect(response.json<VerifySquadTestResponse>().cacheStatus).toBe("miss");
      }

      expect(fetchMock).toHaveBeenCalledTimes(FC25_CLUB_IDS.length);
    } finally {
      await app.close();
    }
  }, 15_000);

  it("verifies a squad, generates suggestion ids, and caches live team responses", async () => {
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

  it("normalises Gemini warning-style attribute types instead of rejecting verification", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-warning-type-aliases");
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
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: [
          {
            type: "stale_profile_flag",
            playerId: "mohamed-salah",
            changes: { age: 34 },
            rationale: "Live data indicates a different age."
          }
        ]
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
      expect(
        response.json<VerifySquadTestResponse>().verification.attributeWarnings[0]
      ).toMatchObject({
        type: "player_update",
        playerId: "mohamed-salah",
        changes: { age: 34 }
      });
    } finally {
      await app.close();
    }
  });

  it("drops Gemini attribute warnings when the proposed value already matches local data", async () => {
    testDatabase = createFc25ServerDatabase("ai-squad-manager-no-op-warnings");
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
    genAiMocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        missingPlayers: [],
        suggestions: [],
        attributeWarnings: [
          {
            type: "age_mismatch",
            playerId: "209331",
            changes: { age: 32 },
            rationale: "Live data confirms this age."
          }
        ]
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
      expect(response.json<VerifySquadTestResponse>().verification.attributeWarnings).toEqual([]);
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

function createFc26Pl20ServerDatabase(prefix: string): TestDatabase {
  const database = createServerTestDatabase(prefix);
  importFc25Dataset({
    databasePath: database.path,
    csvPath: FC26_PL20_FIXTURE_PATH,
    datasetVersionId: "fc26-pl20-base",
    name: "FC26 PL20 base",
    format: "fc26",
    clubUniverse: "pl20",
    now: new Date("2026-05-05T09:00:00.000Z")
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
