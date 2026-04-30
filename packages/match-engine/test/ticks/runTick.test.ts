import { describe, it, expect } from "vitest";
import { runTick } from "../../src/ticks/runTick";
import { buildInitState } from "../../src/state/initState";
import type { MatchConfig, Team } from "../../src/types";

describe("runTick", () => {
  it("advances match clock and iteration", () => {
    const dummyTeam: Team = {
      id: "home-1",
      name: "Home",
      shortName: "HOM",
      players: [],
      tactics: { formation: "4-4-2", mentality: "balanced", tempo: "normal", pressing: "medium", lineHeight: "normal", width: "normal" }
    };

    const config: MatchConfig = {
      homeTeam: dummyTeam,
      awayTeam: { ...dummyTeam, id: "away-1" },
      duration: "second_half",
      seed: 123
    };

    const state = buildInitState(config);
    expect(state.iteration).toBe(0);
    expect(state.matchClock.minute).toBe(45);
    expect(state.matchClock.seconds).toBe(0);

    runTick(state);

    expect(state.iteration).toBe(1);
    expect(state.matchClock.minute).toBe(45);
    expect(state.matchClock.seconds).toBe(3);
  });
});
