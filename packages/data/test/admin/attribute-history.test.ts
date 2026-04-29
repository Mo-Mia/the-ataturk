import { afterEach, describe, expect, it } from "vitest";

import { getPlayerAttributeHistory, updatePlayerAttributes } from "../../src";
import { createMigratedSeededDatabase, type TestDatabase } from "../test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("attribute history helpers", () => {
  it("returns edit history ordered newest first", () => {
    testDatabase = createMigratedSeededDatabase("attribute-history");

    updatePlayerAttributes({
      playerId: "steven-gerrard",
      datasetVersion: "v0-stub",
      changes: { passing: 88 },
      changedBy: "human:admin",
      changedAt: "2026-04-29T10:00:00.000Z"
    });
    updatePlayerAttributes({
      playerId: "steven-gerrard",
      datasetVersion: "v0-stub",
      changes: { shooting: 90 },
      changedBy: "human:admin",
      changedAt: "2026-04-29T10:05:00.000Z"
    });

    const history = getPlayerAttributeHistory("steven-gerrard", "v0-stub", 10);

    expect(history.map((row) => row.attribute_name)).toEqual(["shooting", "passing"]);
    expect(history[0]?.new_value).toBe(90);
    expect(history[1]?.new_value).toBe(88);
  });
});
