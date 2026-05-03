import { describe, expect, it } from "vitest";

import { PITCH_LENGTH, PITCH_WIDTH } from "../../src/calibration/constants";
import { buildInitState } from "../../src/state/initState";
import { createTestConfig } from "../helpers";

describe("buildInitState", () => {
  it("builds a second-half state with formation positions and centre kickoff", () => {
    const state = buildInitState(createTestConfig(42));

    expect(state.iteration).toBe(0);
    expect(state.matchClock).toEqual({ half: 2, minute: 45, seconds: 0 });
    expect(state.score).toEqual({ home: 0, away: 3 });
    expect(state.players).toHaveLength(22);
    expect(state.ball.position).toEqual([PITCH_WIDTH / 2, PITCH_LENGTH / 2, 0]);
    expect(state.players.some((player) => player.teamId === "home" && player.hasBall)).toBe(true);
    expect(
      state.players.every((player) => player.position[0] >= 0 && player.position[0] <= PITCH_WIDTH)
    ).toBe(true);
    expect(
      state.players.every((player) => player.position[1] >= 0 && player.position[1] <= PITCH_LENGTH)
    ).toBe(true);
  });

  it("initialises new side-switch second-half runs in post-half-time direction", () => {
    const config = createTestConfig(42);
    config.dynamics = { sideSwitch: true };
    const state = buildInitState(config);

    expect(state.sideSwitchVersion).toBe(1);
    expect(state.attackDirection).toEqual({ home: -1, away: 1 });
  });

  it("keeps validation-only side-switch disabled runs in legacy direction", () => {
    const config = createTestConfig(42);
    config.dynamics = { sideSwitch: false };
    const state = buildInitState(config);

    expect(state.sideSwitchVersion).toBe(0);
    expect(state.attackDirection).toEqual({ home: 1, away: -1 });
  });

  it("rejects teams without exactly eleven players", () => {
    const config = createTestConfig(42);
    config.homeTeam.players = config.homeTeam.players.slice(0, 10);

    expect(() => buildInitState(config)).toThrow("exactly 11 players");
  });
});
