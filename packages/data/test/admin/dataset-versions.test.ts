import { afterEach, describe, expect, it } from "vitest";

import {
  activateDatasetVersion,
  createDatasetVersion,
  getActiveDatasetVersion,
  getDb,
  getDatasetVersion,
  listDatasetVersions
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

describe("dataset version helpers", () => {
  it("creates, lists, activates, and forks attribute rows from a parent", () => {
    testDatabase = createMigratedSeededDatabase("dataset-versions");

    const realCount = count("SELECT COUNT(*) AS count FROM players WHERE player_origin = 'real'");
    const parentAttributeCount = count(
      "SELECT COUNT(*) AS count FROM player_attributes WHERE dataset_version = ?",
      "v0-stub"
    );

    const created = createDatasetVersion({
      id: "v1-test",
      name: "Test fork",
      description: "Fork for admin tests",
      parent_version_id: "v0-stub",
      created_at: "2026-04-29T10:00:00.000Z",
      updated_at: "2026-04-29T10:00:00.000Z"
    });

    expect(created.id).toBe("v1-test");
    expect(created.is_active).toBe(false);
    expect(created.parent_version_id).toBe("v0-stub");
    expect(parentAttributeCount).toBe(realCount);
    expect(count("SELECT COUNT(*) AS count FROM player_attributes WHERE dataset_version = ?", "v1-test")).toBe(
      realCount
    );
    expect(getDatasetVersion("v1-test")?.name).toBe("Test fork");
    expect(listDatasetVersions().map((version) => version.id)).toContain("v1-test");

    const activated = activateDatasetVersion("v1-test");

    expect(activated.is_active).toBe(true);
    expect(getActiveDatasetVersion()?.id).toBe("v1-test");
  });
});
