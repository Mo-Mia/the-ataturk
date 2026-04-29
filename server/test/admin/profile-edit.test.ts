import type { PlayerProfileHistory } from "@the-ataturk/data";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("admin profile edit routes", () => {
  it("patches player profiles and records history", async () => {
    testDatabase = createServerTestDatabase("profile-edit");
    const app = buildApp();

    try {
      const update = await app.inject({
        method: "PATCH",
        url: "/api/players/sami-hyypia/profile",
        payload: {
          profile_version: "v0-empty",
          changes: { tier: "A", role_2004_05: "First-choice centre-back." },
          changed_by: "human:mo"
        }
      });

      expect(update.statusCode).toBe(200);
      expect(update.json()).toMatchObject({
        player_id: "sami-hyypia",
        tier: "A",
        role_2004_05: "First-choice centre-back.",
        generated_by: "human-edited",
        edited: true
      });

      const history = await app.inject({
        method: "GET",
        url: "/api/players/sami-hyypia/profile-history?version=v0-empty"
      });

      expect(history.statusCode).toBe(200);
      const historyRows = history.json<PlayerProfileHistory[]>();
      expect(historyRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            profile_version: "v0-empty",
            field_name: "tier",
            old_value: "C",
            new_value: "A",
            changed_by: "human:mo"
          })
        ])
      );
    } finally {
      await app.close();
    }
  });

  it("rejects invalid tiers", async () => {
    testDatabase = createServerTestDatabase("profile-invalid");
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/players/sami-hyypia/profile",
        payload: {
          profile_version: "v0-empty",
          changes: { tier: "Z" }
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Profile tier must be one of S, A, B, C, or D"
      });
    } finally {
      await app.close();
    }
  });
});
