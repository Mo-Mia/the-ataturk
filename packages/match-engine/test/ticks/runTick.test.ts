import { describe, expect, it } from "vitest";

import { buildInitState } from "../../src/state/initState";
import { runTick } from "../../src/ticks/runTick";
import { createTestConfig } from "../helpers";

describe("runTick", () => {
  it("advances the clock, moves players, and updates possession", () => {
    const state = buildInitState(createTestConfig(10));
    const before = state.players.map((player) => [...player.position]);

    runTick(state);

    expect(state.iteration).toBe(1);
    expect(state.matchClock).toEqual({ half: 2, minute: 45, seconds: 3 });
    expect(state.possession.teamId).not.toBeNull();
    expect(
      state.players.some(
        (player, index) =>
          player.position[0] !== before[index]![0] || player.position[1] !== before[index]![1]
      )
    ).toBe(true);
  });

  it("settles a ball in flight at the start of the next tick", () => {
    const state = buildInitState(createTestConfig(11));
    state.ball.inFlight = true;
    state.ball.targetPosition = [100, 200, 0];
    state.players.forEach((player) => {
      player.hasBall = false;
      player.onPitch = false;
    });
    state.ball.carrierPlayerId = null;

    runTick(state);

    expect(state.ball.inFlight).toBe(false);
    expect(state.ball.position[0]).toBeGreaterThanOrEqual(0);
  });

  it("keeps off-ball players moving across a sequence of ticks", () => {
    const state = buildInitState(createTestConfig(14));
    const tracked = state.players.find((player) => player.id === "home-5")!;
    const positions = new Set<string>();

    for (let tick = 0; tick < 30; tick += 1) {
      runTick(state);
      positions.add(`${tracked.position[0].toFixed(2)},${tracked.position[1].toFixed(2)}`);
    }

    expect(positions.size).toBeGreaterThan(10);
  });
});
