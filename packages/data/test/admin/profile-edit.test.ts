import { afterEach, describe, expect, it } from "vitest";

import {
  getPlayerProfile,
  getPlayerProfileHistory,
  updatePlayerProfile
} from "../../src";
import { createMigratedSeededDatabase, type TestDatabase } from "../test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("profile edit helpers", () => {
  it("patches a profile, flips edited, and records field history", () => {
    testDatabase = createMigratedSeededDatabase("profile-edit");

    const updated = updatePlayerProfile({
      playerId: "sami-hyypia",
      profileVersion: "v0-empty",
      changes: {
        tier: "A",
        role_2004_05: "First-choice centre-back across Liverpool's European run."
      },
      changedBy: "human:mo",
      changedAt: "2026-04-29T10:00:00.000Z"
    });

    expect(updated).toMatchObject({
      player_id: "sami-hyypia",
      profile_version: "v0-empty",
      tier: "A",
      role_2004_05: "First-choice centre-back across Liverpool's European run.",
      generated_by: "human-edited",
      edited: true
    });
    expect(getPlayerProfile("sami-hyypia", "v0-empty")?.edited).toBe(true);

    const history = getPlayerProfileHistory("sami-hyypia", "v0-empty");

    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field_name: "tier",
          old_value: "C",
          new_value: "A",
          changed_by: "human:mo"
        }),
        expect.objectContaining({
          field_name: "role_2004_05",
          old_value: null,
          new_value: "First-choice centre-back across Liverpool's European run.",
          changed_by: "human:mo"
        })
      ])
    );
  });
});
