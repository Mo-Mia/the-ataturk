import { afterEach, describe, expect, it } from "vitest";

import {
  getActiveDatasetVersion,
  getClub,
  getPlayer,
  getPlayerAttributes,
  listClubs,
  listFixtures,
  listRealPlayersByClub,
  listSquadWithActiveAttributes,
  listUserPlayersByClub
} from "../src/db";
import { createMigratedSeededDatabase, type TestDatabase } from "./test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("typed data query helpers", () => {
  it("returns expected club, player, fixture, dataset, and attributes shapes", () => {
    testDatabase = createMigratedSeededDatabase("db");

    const clubs = listClubs();
    const liverpool = getClub("liverpool");
    const gerrard = getPlayer("steven-gerrard");
    const activeVersion = getActiveDatasetVersion();
    const gerrardAttributes = getPlayerAttributes("steven-gerrard", "v0-stub");
    const fixtures = listFixtures();
    const realPlayers = listRealPlayersByClub("liverpool");
    const userPlayers = listUserPlayersByClub("liverpool");
    const squad = listSquadWithActiveAttributes("liverpool");

    expect(clubs.map((club) => club.id)).toEqual(["ac-milan", "liverpool"]);
    expect(liverpool?.short_name).toBe("LFC");
    expect(gerrard?.player_origin).toBe("real");
    expect(gerrard?.is_captain).toBe(true);
    expect(activeVersion?.id).toBe("v0-stub");
    expect(activeVersion?.is_active).toBe(true);
    expect(gerrardAttributes?.passing).toBe(0);
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]?.home_club_id).toBe("liverpool");
    expect(realPlayers).toHaveLength(26);
    expect(userPlayers).toHaveLength(0);
    expect(squad).toHaveLength(26);
    expect(squad[0]?.attributes?.dataset_version).toBe("v0-stub");
  });
});
