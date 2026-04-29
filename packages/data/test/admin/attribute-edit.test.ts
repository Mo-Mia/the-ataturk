import { afterEach, describe, expect, it } from "vitest";

import {
  createDatasetVersion,
  getPlayerAttributeHistory,
  getPlayerAttributes,
  updatePlayerAttributes
} from "../../src";
import { createMigratedSeededDatabase, type TestDatabase } from "../test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("attribute edit helpers", () => {
  it("updates a forked snapshot and records the first edit history from the forked value", () => {
    testDatabase = createMigratedSeededDatabase("attribute-edit");
    createDatasetVersion({
      id: "v1-test",
      name: "Test fork",
      parent_version_id: "v0-stub",
      created_at: "2026-04-29T10:00:00.000Z",
      updated_at: "2026-04-29T10:00:00.000Z"
    });

    const before = getPlayerAttributes("sami-hyypia", "v1-test");
    const updated = updatePlayerAttributes({
      playerId: "sami-hyypia",
      datasetVersion: "v1-test",
      changes: { tackling: 86 },
      changedBy: "human:mo",
      changedAt: "2026-04-29T10:10:00.000Z"
    });
    const history = getPlayerAttributeHistory("sami-hyypia", "v1-test", 10);

    expect(before?.tackling).toBe(0);
    expect(updated.tackling).toBe(86);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      dataset_version: "v1-test",
      attribute_name: "tackling",
      old_value: 0,
      new_value: 86,
      changed_by: "human:mo"
    });
  });

  it("rejects out-of-range attribute values", () => {
    testDatabase = createMigratedSeededDatabase("attribute-invalid");

    expect(() =>
      updatePlayerAttributes({
        playerId: "sami-hyypia",
        datasetVersion: "v0-stub",
        changes: { tackling: 101 }
      })
    ).toThrow("integer from 0 to 100");
  });
});
