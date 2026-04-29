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
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body[0].attribute_name).toBe("shooting");
      expect(body[1].attribute_name).toBe("passing");
    } finally {
      await app.close();
    }
  });
});
