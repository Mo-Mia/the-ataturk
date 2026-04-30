import { getDb } from "@the-ataturk/data";
import { ProfileExtractionError } from "@the-ataturk/data/llm/gemini";
import { afterEach, describe, expect, it, vi } from "vitest";

const geminiMocks = vi.hoisted(() => ({
  extractPlayerProfile: vi.fn()
}));

vi.mock("@the-ataturk/data/llm/gemini", () => ({
  PROFILE_EXTRACTION_GENERATED_BY: "llm-gemini-3-flash",
  ProfileExtractionError: class extends Error {
    readonly transient: boolean;
    readonly status: number | null;

    constructor(message: string, options: { status?: number | null; transient?: boolean } = {}) {
      super(message);
      this.name = "ProfileExtractionError";
      this.transient = options.transient ?? false;
      this.status = options.status ?? null;
    }
  },
  extractPlayerProfile: geminiMocks.extractPlayerProfile
}));

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

interface ProfileRow {
  tier: string;
  role_2004_05: string | null;
  qualitative_descriptor: string | null;
  generated_by: string;
  edited: number;
}

interface SseEvent {
  event: string;
  data: unknown;
}

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  geminiMocks.extractPlayerProfile.mockReset();
  testDatabase?.cleanup();
  testDatabase = undefined;
});

function profileRow(playerId: string): ProfileRow | undefined {
  return getDb(testDatabase?.path)
    .prepare<[string], ProfileRow>(
      `
        SELECT tier, role_2004_05, qualitative_descriptor, generated_by, edited
        FROM player_profiles
        WHERE player_id = ? AND profile_version = 'v0-empty'
      `
    )
    .get(playerId);
}

function parseSse(body: string): SseEvent[] {
  return body
    .trim()
    .split("\n\n")
    .map((frame) => {
      const event = frame
        .split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice("event: ".length);
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice("data: ".length);

      if (!event || !data) {
        throw new Error(`Invalid SSE frame: ${frame}`);
      }

      return { event, data: JSON.parse(data) as unknown };
    });
}

describe("admin profile extraction route", () => {
  it("persists a successful mocked Gemini extraction", async () => {
    testDatabase = createServerTestDatabase("profile-extraction-success");
    geminiMocks.extractPlayerProfile.mockResolvedValueOnce({
      tier: "A",
      role_2004_05: "First-choice centre-back.",
      qualitative_descriptor: "Dominant aerial defender with elite positioning."
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/profile-extraction/run",
        payload: {
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: { total: 1, succeeded: 1, failed: 0 }
      });
      expect(profileRow("sami-hyypia")).toMatchObject({
        tier: "A",
        role_2004_05: "First-choice centre-back.",
        generated_by: "llm-gemini-3-flash",
        edited: 0
      });
    } finally {
      await app.close();
    }
  });

  it("retries once after a Gemini failure and persists the retry result", async () => {
    testDatabase = createServerTestDatabase("profile-extraction-retry");
    geminiMocks.extractPlayerProfile
      .mockRejectedValueOnce(
        new ProfileExtractionError("temporary Gemini failure", { transient: true })
      )
      .mockResolvedValueOnce({
        tier: "A",
        role_2004_05: "First-choice centre-back after retry.",
        qualitative_descriptor: "Dominant aerial defender after retry."
      });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/profile-extraction/run",
        payload: {
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(geminiMocks.extractPlayerProfile).toHaveBeenCalledTimes(2);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: { total: 1, succeeded: 1, failed: 0 }
      });
      expect(profileRow("sami-hyypia")?.role_2004_05).toBe("First-choice centre-back after retry.");
    } finally {
      await app.close();
    }
  });

  it("does not retry deterministic extraction failures", async () => {
    testDatabase = createServerTestDatabase("profile-extraction-no-retry");
    geminiMocks.extractPlayerProfile.mockRejectedValueOnce(
      new ProfileExtractionError("Gemini returned invalid JSON for profile extraction", {
        transient: false
      })
    );
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/profile-extraction/run",
        payload: {
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(geminiMocks.extractPlayerProfile).toHaveBeenCalledTimes(1);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: {
          total: 1,
          succeeded: 0,
          failed: 1,
          failed_player_ids: ["sami-hyypia"]
        }
      });
      expect(profileRow("sami-hyypia")).toMatchObject({
        generated_by: "llm-extraction-failed",
        edited: 0
      });
    } finally {
      await app.close();
    }
  });

  it("marks total failures and continues to the next player", async () => {
    testDatabase = createServerTestDatabase("profile-extraction-failure");
    geminiMocks.extractPlayerProfile.mockImplementation((input: { playerName: string }) => {
      if (input.playerName === "Sami Hyypiä") {
        return Promise.reject(new Error("permanent Gemini failure"));
      }

      return Promise.resolve({
        tier: "A",
        role_2004_05: "Liverpool captain and midfield talisman.",
        qualitative_descriptor: "Explosive all-round midfielder with leadership and range."
      });
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/profile-extraction/run",
        payload: {
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia", "steven-gerrard"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: {
          total: 2,
          succeeded: 1,
          failed: 1,
          failed_player_ids: ["sami-hyypia"]
        }
      });
      expect(profileRow("sami-hyypia")).toMatchObject({
        generated_by: "llm-extraction-failed",
        edited: 0
      });
      expect(profileRow("steven-gerrard")).toMatchObject({
        role_2004_05: "Liverpool captain and midfield talisman.",
        generated_by: "llm-gemini-3-flash"
      });
    } finally {
      await app.close();
    }
  });

  it("pauses the batch without marking the row when a transient failure survives retry", async () => {
    testDatabase = createServerTestDatabase("profile-extraction-transient-abort");
    geminiMocks.extractPlayerProfile.mockRejectedValue(
      new ProfileExtractionError("Gemini returned 429", { status: 429, transient: true })
    );
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/profile-extraction/run",
        payload: {
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia", "steven-gerrard"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(geminiMocks.extractPlayerProfile).toHaveBeenCalledTimes(2);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: {
          total: 2,
          succeeded: 0,
          failed: 1,
          failed_player_ids: ["sami-hyypia"],
          aborted: true
        }
      });
      expect(profileRow("sami-hyypia")).toMatchObject({
        generated_by: "human",
        role_2004_05: null,
        edited: 0
      });
      expect(profileRow("steven-gerrard")).toMatchObject({
        generated_by: "human",
        role_2004_05: null,
        edited: 0
      });
    } finally {
      await app.close();
    }
  });
});
