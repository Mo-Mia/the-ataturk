import { describe, it, expect } from "vitest";
import { buildInitState } from "../../src/state/initState";
import type { MatchConfig, Team } from "../../src/types";

describe("initState", () => {
  it("builds a valid core state from config", () => {
    const dummyTeam: Team = {
      id: "home-1",
      name: "Home",
      shortName: "HOM",
      players: [
         { id: "p1", name: "Player 1", shortName: "P1", position: "GK", attributes: { passing: 50, shooting: 50, tackling: 50, saving: 50, agility: 50, strength: 50, penaltyTaking: 50, perception: 50, jumping: 50, control: 50 } }
      ],
      tactics: { formation: "4-4-2", mentality: "balanced", tempo: "normal", pressing: "medium", lineHeight: "normal", width: "normal" }
    };

    const config: MatchConfig = {
      homeTeam: dummyTeam,
      awayTeam: { ...dummyTeam, id: "away-1", name: "Away", shortName: "AWA" },
      duration: "second_half",
      seed: 123
    };

    const state = buildInitState(config);

    expect(state.iteration).toBe(0);
    expect(state.matchClock.half).toBe(2);
    expect(state.matchClock.minute).toBe(45);
    expect(state.players).toHaveLength(2); // 1 home + 1 away
    expect(state.score.home).toBe(0);
    expect(state.ball.position[0]).toBeGreaterThan(0);
  });
});
