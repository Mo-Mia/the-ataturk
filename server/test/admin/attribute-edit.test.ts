import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("admin attribute edit routes", () => {
  it("patches player attributes and records history", async () => {
    testDatabase = createServerTestDatabase("attribute-edit");
    const app = buildApp();

    try {
      const update = await app.inject({
        method: "PATCH",
        url: "/api/players/sami-hyypia/attributes",
        payload: {
          dataset_version: "v0-stub",
          changes: { tackling: 86 },
          changed_by: "human:mo"
        }
      });

      expect(update.statusCode).toBe(200);
      expect(update.json()).toMatchObject({ player_id: "sami-hyypia", tackling: 86 });

      const history = await app.inject({
        method: "GET",
        url: "/api/players/sami-hyypia/attribute-history?version=v0-stub"
      });

      expect(history.statusCode).toBe(200);
      expect(history.json()[0]).toMatchObject({
        dataset_version: "v0-stub",
        attribute_name: "tackling",
        old_value: 0,
        new_value: 86,
        changed_by: "human:mo"
      });
    } finally {
      await app.close();
    }
  });

  it("rejects out-of-range attribute values", async () => {
    testDatabase = createServerTestDatabase("attribute-invalid");
    const app = buildApp();

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/players/sami-hyypia/attributes",
        payload: {
          dataset_version: "v0-stub",
          changes: { tackling: 101 }
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Attribute 'tackling' must be an integer from 0 to 100"
      });
    } finally {
      await app.close();
    }
  });
});
