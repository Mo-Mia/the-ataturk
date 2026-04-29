import type { PlayerAttributeHistory } from "@the-ataturk/data";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("admin attribute history routes", () => {
  it("returns history rows ordered newest first", async () => {
    testDatabase = createServerTestDatabase("attribute-history");
    const app = buildApp();

    try {
      await app.inject({
        method: "PATCH",
        url: "/api/players/steven-gerrard/attributes",
        payload: {
          dataset_version: "v0-stub",
          changes: { passing: 88 }
        }
      });
      await app.inject({
        method: "PATCH",
        url: "/api/players/steven-gerrard/attributes",
        payload: {
          dataset_version: "v0-stub",
          changes: { shooting: 90 }
        }
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/players/steven-gerrard/attribute-history?version=v0-stub&limit=10"
      });
      const body = response.json<PlayerAttributeHistory[]>();

      expect(response.statusCode).toBe(200);
      expect(body).toHaveLength(2);
      const latest = body.at(0);
      const previous = body.at(1);

      if (!latest || !previous) {
        throw new Error("Expected two history rows");
      }

      expect(latest.attribute_name).toBe("shooting");
      expect(previous.attribute_name).toBe("passing");
    } finally {
      await app.close();
    }
  });
});
