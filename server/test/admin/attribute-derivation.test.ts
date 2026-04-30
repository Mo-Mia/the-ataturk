import { createDatasetVersion, getDb } from "@the-ataturk/data";
import { AttributeDerivationError } from "@the-ataturk/data/llm/gemini";
import { afterEach, describe, expect, it, vi } from "vitest";

const geminiMocks = vi.hoisted(() => ({
  derivePlayerAttributes: vi.fn()
}));

vi.mock("@the-ataturk/data/llm/gemini", () => ({
  DERIVATION_GENERATED_BY: "llm-gemini-3-flash",
  AttributeDerivationError: class extends Error {
    readonly transient: boolean;
    readonly status: number | null;

    constructor(message: string, options: { status?: number | null; transient?: boolean } = {}) {
      super(message);
      this.name = "AttributeDerivationError";
      this.transient = options.transient ?? false;
      this.status = options.status ?? null;
    }
  },
  derivePlayerAttributes: geminiMocks.derivePlayerAttributes
}));

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

interface CountRow {
  count: number;
}

interface AttributeRow {
  passing: number;
  tackling: number;
  generated_by: string;
}

interface HistoryRow {
  old_value: number;
  new_value: number;
  changed_by: string;
}

interface SseEvent {
  event: string;
  data: unknown;
}

interface ErrorResponse {
  error: string;
}

interface PreflightResponse {
  ready: boolean;
  candidate_count: number;
  errors?: string[];
}

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  geminiMocks.derivePlayerAttributes.mockReset();
  testDatabase?.cleanup();
  testDatabase = undefined;
});

function setupDerivationDatabase(name: string): TestDatabase {
  const database = createServerTestDatabase(name);
  const db = getDb(database.path);
  createDatasetVersion(
    { id: "v1-derived", name: "Derived test", parent_version_id: "v0-stub" },
    db
  );
  db.prepare(
    `
      UPDATE player_profiles
      SET tier = 'B',
          role_2004_05 = 'Curated role.',
          qualitative_descriptor = 'Curated descriptor.',
          edited = 1
      WHERE profile_version = 'v0-empty'
    `
  ).run();
  return database;
}

function playerCount(): number {
  return (
    getDb(testDatabase?.path).prepare<[], CountRow>("SELECT COUNT(*) AS count FROM players").get()
      ?.count ?? 0
  );
}

function generatedCount(): number {
  return (
    getDb(testDatabase?.path)
      .prepare<[], CountRow>(
        `
          SELECT COUNT(*) AS count
          FROM player_attributes
          WHERE dataset_version = 'v1-derived'
            AND generated_by = 'llm-gemini-3-flash'
        `
      )
      .get()?.count ?? 0
  );
}

function attributeRow(playerId: string): AttributeRow | undefined {
  return getDb(testDatabase?.path)
    .prepare<[string], AttributeRow>(
      `
        SELECT passing, tackling, generated_by
        FROM player_attributes
        WHERE player_id = ? AND dataset_version = 'v1-derived'
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

function validAttributesForPosition(input: { position: string }) {
  if (input.position === "GK") {
    return {
      passing: 60,
      shooting: 20,
      tackling: 30,
      saving: 80,
      agility: 72,
      strength: 45,
      penalty_taking: 30,
      perception: 75,
      jumping: 75,
      control: 60
    };
  }

  return {
    passing: 82,
    shooting: 72,
    tackling: 72,
    saving: 10,
    agility: 72,
    strength: 72,
    penalty_taking: 60,
    perception: 72,
    jumping: 70,
    control: 72
  };
}

describe("admin attribute derivation route", () => {
  it("persists a successful mocked derivation for every candidate", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-success");
    geminiMocks.derivePlayerAttributes.mockImplementation(validAttributesForPosition);
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v1-derived",
          profile_version: "v0-empty"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: { total: playerCount(), succeeded: playerCount(), failed: 0 }
      });
      expect(generatedCount()).toBe(playerCount());
    } finally {
      await app.close();
    }
  });

  it("retries a transient Gemini failure once", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-transient-retry");
    geminiMocks.derivePlayerAttributes
      .mockRejectedValueOnce(new AttributeDerivationError("temporary", { transient: true }))
      .mockImplementation(validAttributesForPosition);
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v1-derived",
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(geminiMocks.derivePlayerAttributes).toHaveBeenCalledTimes(2);
      expect(attributeRow("sami-hyypia")).toMatchObject({
        generated_by: "llm-gemini-3-flash"
      });
    } finally {
      await app.close();
    }
  });

  it("retries a validation failure once and persists the valid retry", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-validation-retry");
    geminiMocks.derivePlayerAttributes
      .mockResolvedValueOnce({
        ...validAttributesForPosition({ position: "CB" }),
        saving: 60
      })
      .mockImplementation(validAttributesForPosition);
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v1-derived",
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia"]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(geminiMocks.derivePlayerAttributes).toHaveBeenCalledTimes(2);
      expect(geminiMocks.derivePlayerAttributes.mock.calls[1]?.[0]).toMatchObject({
        validationFeedback: ["Outfield players must have saving of 25 or lower"]
      });
      expect(attributeRow("sami-hyypia")).toMatchObject({
        passing: 82,
        generated_by: "llm-gemini-3-flash"
      });
    } finally {
      await app.close();
    }
  });

  it("marks validation failures after retry and continues to the next player", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-validation-failure");
    geminiMocks.derivePlayerAttributes.mockImplementation(
      (input: { playerName: string; position: string }) => {
        if (input.playerName === "Sami Hyypiä") {
          return Promise.resolve({
            ...validAttributesForPosition(input),
            saving: 60
          });
        }

        return Promise.resolve(validAttributesForPosition(input));
      }
    );
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v1-derived",
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
      expect(attributeRow("sami-hyypia")).toMatchObject({
        generated_by: "llm-attribute-derivation-failed"
      });
      expect(attributeRow("steven-gerrard")).toMatchObject({
        generated_by: "llm-gemini-3-flash"
      });
    } finally {
      await app.close();
    }
  });

  it("refuses to derive into v0-stub", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-refuse-stub");
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v0-stub",
          profile_version: "v0-empty"
        }
      });

      expect(response.statusCode).toBe(400);
      const body = response.json<ErrorResponse>();
      expect(body.error).toContain("Refusing to derive attributes into v0-stub");
    } finally {
      await app.close();
    }
  });

  it("refuses when the profile version has incomplete entries", async () => {
    testDatabase = createServerTestDatabase("attribute-derivation-uncurated");
    createDatasetVersion({
      id: "v1-derived",
      name: "Derived test",
      parent_version_id: "v0-stub"
    });
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/attribute-derivation/preflight?dataset_version=v1-derived&profile_version=v0-empty"
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<PreflightResponse>();
      expect(body.ready).toBe(false);
      expect(body.errors?.some((error) => error.includes("role_2004_05 is missing"))).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("stops after five consecutive transient failures", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-circuit-breaker");
    geminiMocks.derivePlayerAttributes.mockRejectedValue(
      new AttributeDerivationError("Gemini returned 429", { status: 429, transient: true })
    );
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v1-derived",
          profile_version: "v0-empty",
          player_ids: [
            "sami-hyypia",
            "steven-gerrard",
            "xabi-alonso",
            "dida",
            "kaka",
            "paolo-maldini"
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      expect(geminiMocks.derivePlayerAttributes).toHaveBeenCalledTimes(10);
      expect(parseSse(response.body).at(-1)).toMatchObject({
        event: "summary",
        data: {
          total: 6,
          succeeded: 0,
          failed: 5,
          aborted: true
        }
      });
    } finally {
      await app.close();
    }
  });

  it("writes derivation history with the forked value as old_value", async () => {
    testDatabase = setupDerivationDatabase("attribute-derivation-history");
    geminiMocks.derivePlayerAttributes.mockResolvedValueOnce({
      ...validAttributesForPosition({ position: "CB" }),
      tackling: 86
    });
    const app = buildApp();

    try {
      await app.inject({
        method: "POST",
        url: "/api/attribute-derivation/run",
        payload: {
          dataset_version: "v1-derived",
          profile_version: "v0-empty",
          player_ids: ["sami-hyypia"]
        }
      });

      const history = getDb(testDatabase.path)
        .prepare<[string, string, string], HistoryRow>(
          `
            SELECT old_value, new_value, changed_by
            FROM player_attribute_history
            WHERE player_id = ? AND dataset_version = ? AND attribute_name = ?
          `
        )
        .get("sami-hyypia", "v1-derived", "tackling");

      expect(history).toEqual({
        old_value: 0,
        new_value: 86,
        changed_by: "llm-gemini-3-flash"
      });
    } finally {
      await app.close();
    }
  });
});
