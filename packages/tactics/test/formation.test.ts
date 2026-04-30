import { describe, expect, it } from "vitest";

import { LIVERPOOL_FORMATION, MILAN_FORMATION, applyFormation, type FormationName } from "../src";
import type { TeamInput } from "@the-ataturk/engine";

function createTeam(playerCount = 11): TeamInput {
  return {
    name: "Test Team",
    players: Array.from({ length: playerCount }, (_, index) => ({
      name: `Player ${index + 1}`,
      position: index === 0 ? "GK" : "CM",
      rating: 70,
      skill: {
        passing: 70,
        shooting: 70,
        tackling: 70,
        saving: 20,
        agility: 70,
        strength: 70,
        penalty_taking: 70,
        perception: 70,
        jumping: 70,
        control: 70
      },
      currentPOS: [0, 0],
      fitness: 100,
      height: 180,
      injured: false
    }))
  };
}

function positionsFor(formation: FormationName): number[][] {
  return applyFormation(createTeam(), formation).players.map((player) => player.currentPOS);
}

describe("applyFormation", () => {
  it("places a team into the 4-4-2 template", () => {
    expect(positionsFor("4-4-2")).toEqual(LIVERPOOL_FORMATION);
  });

  it("places a team into the 4-3-1-2 template", () => {
    expect(positionsFor("4-3-1-2")).toEqual(MILAN_FORMATION);
  });

  it("does not mutate the input team", () => {
    const team = createTeam();
    const before = structuredClone(team);

    applyFormation(team, "4-4-2");

    expect(team).toEqual(before);
  });

  it("throws when the team does not have exactly 11 players", () => {
    expect(() => applyFormation(createTeam(10), "4-4-2")).toThrow(
      "Formation translation requires exactly 11 players"
    );
  });
});
