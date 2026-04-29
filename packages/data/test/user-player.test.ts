import { afterEach, describe, expect, it } from "vitest";

import {
  insertUserPlayer,
  listRealPlayersByClub,
  listUserPlayersByClub,
  type InsertUserPlayerInput
} from "../src";
import { createMigratedSeededDatabase, type TestDatabase } from "./test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("user-created player schema support", () => {
  it("accepts a valid user-created player and partitions it away from real players", () => {
    testDatabase = createMigratedSeededDatabase("user-player");

    const playerData: InsertUserPlayerInput = {
      id: "mo-test-player",
      club_id: "liverpool",
      name: "Mo Test Player",
      short_name: "Mo",
      squad_number: 99,
      position_primary: "CM",
      position_secondary: "AM",
      date_of_birth: "1984-05-25",
      nationality: "England",
      height_cm: 180,
      user_id: "user:mo",
      preset_archetype: "box-to-box",
      budget_used: 420
    };

    const inserted = insertUserPlayer(playerData);
    const realPlayers = listRealPlayersByClub("liverpool");
    const userPlayers = listUserPlayersByClub("liverpool");

    expect(inserted.player_origin).toBe("user_created");
    expect(inserted.user_id).toBe("user:mo");
    expect(inserted.preset_archetype).toBe("box-to-box");
    expect(inserted.budget_used).toBe(420);
    expect(realPlayers.some((player) => player.id === playerData.id)).toBe(false);
    expect(userPlayers.map((player) => player.id)).toEqual([playerData.id]);
  });
});
