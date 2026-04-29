import { afterEach, describe, expect, it } from "vitest";

import {
  activateProfileVersion,
  createProfileVersion,
  getActiveProfileVersion,
  getDb,
  getProfileVersion,
  listProfileVersions
} from "../../src";
import { createMigratedSeededDatabase, type TestDatabase } from "../test-db";

interface CountRow {
  count: number;
}

let testDatabase: TestDatabase | undefined;

function count(sql: string, ...params: unknown[]): number {
  const row = getDb(testDatabase?.path).prepare(sql).get(...params) as CountRow | undefined;
  return row?.count ?? 0;
}

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("profile version helpers", () => {
  it("creates, lists, activates, and forks profile rows from a parent", () => {
    testDatabase = createMigratedSeededDatabase("profile-versions");

    const realCount = count("SELECT COUNT(*) AS count FROM players WHERE player_origin = 'real'");
    const parentProfileCount = count(
      "SELECT COUNT(*) AS count FROM player_profiles WHERE profile_version = ?",
      "v0-empty"
    );

    const created = createProfileVersion({
      id: "v1-test",
      name: "Test profile fork",
      description: "Fork for admin tests",
      parent_version_id: "v0-empty",
      created_at: "2026-04-29T10:00:00.000Z",
      updated_at: "2026-04-29T10:00:00.000Z"
    });

    expect(created.id).toBe("v1-test");
    expect(created.is_active).toBe(false);
    expect(created.parent_version_id).toBe("v0-empty");
    expect(parentProfileCount).toBe(realCount);
    expect(count("SELECT COUNT(*) AS count FROM player_profiles WHERE profile_version = ?", "v1-test")).toBe(
      realCount
    );
    expect(getProfileVersion("v1-test")?.name).toBe("Test profile fork");
    expect(listProfileVersions().map((version) => version.id)).toContain("v1-test");

    const activated = activateProfileVersion("v1-test");

    expect(activated.is_active).toBe(true);
    expect(getActiveProfileVersion()?.id).toBe("v1-test");
  });
});
