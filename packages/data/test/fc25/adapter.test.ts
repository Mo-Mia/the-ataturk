import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { adaptFc25RowToPlayerInputV2, parseFc25PlayersCsv } from "../../src/fc25";

const fixturePath = resolve("../..", "data/fc-25/fixtures/male_players_top5pl.csv");
const fixtureRows = parseFc25PlayersCsv(readFileSync(fixturePath, "utf8"));

describe("adaptFc25RowToPlayerInputV2", () => {
  it("maps Arsenal golden row: Martin Ødegaard", () => {
    const player = adaptGolden("Martin Ødegaard");

    expect(player).toMatchObject({
      id: "222665",
      name: "Martin Ødegaard",
      shortName: "Ødegaard",
      position: "CM",
      preferredFoot: "left",
      weakFootRating: 2,
      skillMovesRating: 5,
      height: 178,
      weight: 68,
      age: 25
    });
    expect(player.attributes.vision).toBe(91);
    expect(player.attributes.shortPassing).toBe(91);
    expect(player.attributes.ballControl).toBe(91);
    expect(player.gkAttributes).toBeUndefined();
  });

  it("maps Manchester City golden row: Rodri", () => {
    const player = adaptGolden("Rodri");

    expect(player).toMatchObject({
      id: "231866",
      name: "Rodri",
      shortName: "Rodri",
      position: "DM",
      preferredFoot: "right",
      weakFootRating: 4,
      skillMovesRating: 3,
      height: 191,
      weight: 82,
      age: 28
    });
    expect(player.attributes.shortPassing).toBe(93);
    expect(player.attributes.longPassing).toBe(91);
    expect(player.attributes.defensiveAwareness).toBe(92);
  });

  it("maps Manchester United golden row: Bruno Fernandes", () => {
    const player = adaptGolden("Bruno Fernandes");

    expect(player).toMatchObject({
      id: "212198",
      name: "Bruno Fernandes",
      shortName: "Fernandes",
      position: "AM",
      preferredFoot: "right",
      weakFootRating: 3,
      skillMovesRating: 4,
      height: 179,
      weight: 69,
      age: 30
    });
    expect(player.attributes.vision).toBe(94);
    expect(player.attributes.penalties).toBe(90);
    expect(player.attributes.stamina).toBe(95);
  });

  it("maps Liverpool golden row: Alisson", () => {
    const player = adaptGolden("Alisson");

    expect(player).toMatchObject({
      id: "212831",
      name: "Alisson",
      shortName: "Alisson",
      position: "GK",
      preferredFoot: "right",
      weakFootRating: 3,
      skillMovesRating: 1,
      height: 193,
      weight: 91,
      age: 31
    });
    expect(player.attributes.reactions).toBe(87);
    expect(player.gkAttributes).toEqual({
      gkDiving: 86,
      gkHandling: 85,
      gkKicking: 85,
      gkPositioning: 90,
      gkReflexes: 89
    });
  });

  it("maps Aston Villa golden row: Emiliano Martínez", () => {
    const player = adaptGolden("Emiliano Martínez");

    expect(player).toMatchObject({
      id: "202811",
      name: "Emiliano Martínez",
      shortName: "Martínez",
      position: "GK",
      preferredFoot: "right",
      weakFootRating: 4,
      skillMovesRating: 1,
      height: 195,
      weight: 88,
      age: 32
    });
    expect(player.gkAttributes).toEqual({
      gkDiving: 84,
      gkHandling: 82,
      gkKicking: 83,
      gkPositioning: 87,
      gkReflexes: 86
    });
  });

  it("keeps the reduced fixture portable and club-scoped", () => {
    const counts = new Map<string, number>();
    for (const row of fixtureRows) {
      counts.set(row.sourceTeam, (counts.get(row.sourceTeam) ?? 0) + 1);
    }

    expect(fixtureRows).toHaveLength(125);
    expect(Object.fromEntries(counts)).toEqual({
      Arsenal: 25,
      "Manchester City": 25,
      "Man Utd": 25,
      Liverpool: 25,
      "Aston Villa": 25
    });
  });
});

function adaptGolden(name: string) {
  const row = fixtureRows.find((candidate) => candidate.name === name);
  if (!row) {
    throw new Error(`Missing golden fixture row for ${name}`);
  }
  return adaptFc25RowToPlayerInputV2(row);
}
