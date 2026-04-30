import { describe, expect, it } from "vitest";

import { selectCarrierAction } from "../../src/resolution/carrierAction";
import { performPass } from "../../src/resolution/actions/pass";
import { performShot } from "../../src/resolution/actions/shot";
import { shotDistanceContext } from "../../src/resolution/shotDistance";
import { buildInitState } from "../../src/state/initState";
import { actionIsVulnerableForTest, runTick } from "../../src/ticks/runTick";
import { createTestConfig } from "../helpers";

describe("carrier action selection", () => {
  it("produces varied weighted actions from the same possession state", () => {
    const actions = new Set<string>();

    const state = buildInitState(createTestConfig(12));
    const carrier = state.players.find((player) => player.hasBall)!;
    state.possession.zone = "att";
    state.possession.pressureLevel = "medium";

    for (let count = 0; count < 100; count += 1) {
      actions.add(selectCarrierAction(state, carrier));
    }

    expect(actions.size).toBeGreaterThan(1);
  });

  it("only treats pass, dribble and hold as tackle-vulnerable", () => {
    expect(actionIsVulnerableForTest("pass")).toBe(true);
    expect(actionIsVulnerableForTest("dribble")).toBe(true);
    expect(actionIsVulnerableForTest("hold")).toBe(true);
    expect(actionIsVulnerableForTest("shoot")).toBe(false);
    expect(actionIsVulnerableForTest("clear")).toBe(false);
  });

  it("can send a failed pass out for a throw-in", () => {
    const state = buildInitState(createTestConfig(15));
    const carrier = state.players.find((player) => player.hasBall)!;
    carrier.baseInput.attributes.passing = 0;
    const rolls = [0.5, 0];
    state.rng.next = () => rolls.shift() ?? 0;

    performPass(state, carrier);

    expect(state.eventsThisTick.some((event) => event.type === "throw_in")).toBe(true);
    expect(state.ball.position[0] === 0 || state.ball.position[0] === 680).toBe(true);
  });

  it("penalises long-range shot selection", () => {
    const near = shotDistanceContext("home", [340, 930]);
    const far = shotDistanceContext("home", [340, 710]);

    expect(near.actionWeight).toBeGreaterThan(far.actionWeight);
    expect(near.onTarget).toBeGreaterThan(far.onTarget);
  });

  it("leaves a scored goal in the net until the next tick restart", () => {
    const state = buildInitState(createTestConfig(22));
    const shooter = state.players.find(
      (player) => player.teamId === "home" && player.baseInput.position === "ST"
    )!;
    const keeper = state.players.find(
      (player) => player.teamId === "away" && player.baseInput.position === "GK"
    )!;
    shooter.position = [340, 930];
    shooter.hasBall = true;
    keeper.baseInput.attributes.saving = 0;
    state.players.forEach((player) => {
      player.hasBall = player.id === shooter.id;
    });
    state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
    const rolls = [0, 1];
    state.rng.next = () => rolls.shift() ?? 1;

    performShot(state, shooter);

    expect(state.pendingRestartTeam).toBe("away");
    expect(state.ball.position).toEqual([340, 1050, 0]);
    expect(state.ball.carrierPlayerId).toBeNull();
    expect(state.players.some((player) => player.hasBall)).toBe(false);

    runTick(state);

    expect(state.pendingRestartTeam).toBeNull();
    expect(state.eventsThisTick.some((event) => event.type === "kick_off")).toBe(true);
    expect(state.ball.position[0]).toBe(340);
    expect(state.ball.position[1]).toBeGreaterThan(525);
  });
});
