import { describe, expect, it } from "vitest";

import { buildInitState } from "../../src/state/initState";
import { runTick } from "../../src/ticks/runTick";
import { updateMovement } from "../../src/ticks/movement";
import { distance } from "../../src/utils/geometry";
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

  it("keeps wide players close to their lateral channels when they are not involved", () => {
    const state = buildInitState(createTestConfig(16));
    const carrier = state.players.find((player) => player.id === "home-2")!;
    const rightWing = state.players.find((player) => player.id === "home-5")!;
    const leftWing = state.players.find((player) => player.id === "home-8")!;

    state.players.forEach((player) => {
      player.hasBall = player.id === carrier.id;
    });
    carrier.position = [340, 525];
    state.ball.position = [340, 525, 0];
    state.ball.carrierPlayerId = carrier.id;
    state.possession = { teamId: "home", zone: "mid", pressureLevel: "low" };

    for (let tick = 0; tick < 12; tick += 1) {
      updateMovement(state);
    }

    expect(Math.abs(rightWing.position[0] - rightWing.lateralAnchor)).toBeLessThanOrEqual(90);
    expect(Math.abs(leftWing.position[0] - leftWing.lateralAnchor)).toBeLessThanOrEqual(90);
  });

  it("tucks far-side wide players in when the ball is on the opposite flank", () => {
    const state = buildInitState(createTestConfig(18));
    const carrier = state.players.find((player) => player.id === "home-6")!;
    const leftWing = state.players.find((player) => player.id === "home-8")!;

    state.players.forEach((player) => {
      player.hasBall = player.id === carrier.id;
    });
    carrier.position = [560, 590];
    state.ball.position = [560, 590, 0];
    state.ball.carrierPlayerId = carrier.id;
    state.possession = { teamId: "home", zone: "mid", pressureLevel: "low" };

    updateMovement(state);

    expect(leftWing.targetPosition[0]).toBeGreaterThan(leftWing.lateralAnchor);
    expect(leftWing.targetPosition[0]).toBeLessThanOrEqual(245);
  });

  it("sends near-side wide players on forward runs when a central player carries", () => {
    const state = buildInitState(createTestConfig(19));
    const carrier = state.players.find((player) => player.id === "home-6")!;
    const rightWing = state.players.find((player) => player.id === "home-5")!;
    const rightBack = state.players.find((player) => player.id === "home-1")!;

    state.players.forEach((player) => {
      player.hasBall = player.id === carrier.id;
    });
    carrier.position = [390, 590];
    state.ball.position = [390, 590, 0];
    state.ball.carrierPlayerId = carrier.id;
    state.possession = { teamId: "home", zone: "mid", pressureLevel: "low" };

    updateMovement(state);

    expect(rightWing.targetPosition[1]).toBeGreaterThan(rightWing.anchorPosition[1] + 20);
    expect(rightBack.targetPosition[1]).toBeGreaterThan(rightBack.anchorPosition[1] + 20);
    expect(rightBack.targetPosition[0]).toBeGreaterThan(rightWing.targetPosition[0]);
  });

  it("lets midfielders and full-backs support beyond halfway when attack momentum is high", () => {
    const state = buildInitState(createTestConfig(20));
    const carrier = state.players.find((player) => player.id === "home-9")!;
    const centralMidfielder = state.players.find((player) => player.id === "home-6")!;
    const rightBack = state.players.find((player) => player.id === "home-1")!;

    state.players.forEach((player) => {
      player.hasBall = player.id === carrier.id;
    });
    carrier.position = [390, 650];
    state.ball.position = [390, 650, 0];
    state.ball.carrierPlayerId = carrier.id;
    state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
    state.attackMomentum.home = 75;

    updateMovement(state);

    expect(centralMidfielder.targetPosition[1]).toBeGreaterThan(525);
    expect(rightBack.targetPosition[1]).toBeGreaterThan(525);
  });

  it("keeps defensive centre-backs conservative during high attacking momentum", () => {
    const state = buildInitState(createTestConfig(21));
    const carrier = state.players.find((player) => player.id === "home-9")!;
    const centreBack = state.players.find((player) => player.id === "home-2")!;

    state.players.forEach((player) => {
      player.hasBall = player.id === carrier.id;
    });
    carrier.position = [390, 650];
    state.ball.position = [390, 650, 0];
    state.ball.carrierPlayerId = carrier.id;
    state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
    state.attackMomentum.home = 85;

    updateMovement(state);

    expect(centreBack.targetPosition[1]).toBeLessThan(525);
  });

  it("caps player movement to sixty pitch units per tick", () => {
    const state = buildInitState(createTestConfig(17));
    const player = state.players.find((candidate) => candidate.id === "away-10")!;
    const before: [number, number] = [20, 20];
    player.position = before;
    player.anchorPosition = [660, 1030];
    player.lateralAnchor = 660;
    state.pendingGoal = {
      scoringTeam: "home",
      restartTeam: "away",
      scorerPlayerId: "home-9",
      score: { home: 1, away: 3 },
      ticksUntilKickoff: 4
    };

    updateMovement(state);

    expect(distance(before, player.position)).toBeLessThanOrEqual(60);
  });
});
