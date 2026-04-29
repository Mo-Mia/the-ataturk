import { getDb } from "@the-ataturk/data";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

interface CountRow {
  count: number;
}

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

function realPlayerCount(): number {
  return (
    getDb(testDatabase?.path)
      .prepare<[], CountRow>("SELECT COUNT(*) AS count FROM players WHERE player_origin = 'real'")
      .get()?.count ?? 0
  );
}

describe("admin profile version routes", () => {
  it("lists, creates a fork, and activates profile versions", async () => {
    testDatabase = createServerTestDatabase("profile-versions");
    const app = buildApp();

    try {
      const listBefore = await app.inject({
        method: "GET",
        url: "/api/profile-versions"
      });

      expect(listBefore.statusCode).toBe(200);
      expect(listBefore.json()).toHaveLength(1);

      const create = await app.inject({
        method: "POST",
        url: "/api/profile-versions",
        payload: {
          id: "v1-test",
          name: "Test fork",
          parent_version_id: "v0-empty"
        }
      });

      expect(create.statusCode).toBe(200);
      expect(create.json()).toMatchObject({ id: "v1-test", parent_version_id: "v0-empty" });

      const copiedCount =
        getDb(testDatabase.path)
          .prepare<
            [string],
            CountRow
          >("SELECT COUNT(*) AS count FROM player_profiles WHERE profile_version = ?")
          .get("v1-test")?.count ?? 0;

      expect(copiedCount).toBe(realPlayerCount());

      const activate = await app.inject({
        method: "POST",
        url: "/api/profile-versions/v1-test/activate"
      });

      expect(activate.statusCode).toBe(200);
      expect(activate.json()).toMatchObject({ id: "v1-test", is_active: true });
    } finally {
      await app.close();
    }
  });
});
