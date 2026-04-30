import { describe, expect, it } from "vitest";

import { selectCarrierAction } from "../../src/resolution/carrierAction";
import { performPass } from "../../src/resolution/actions/pass";
import { buildInitState } from "../../src/state/initState";
import { actionIsVulnerableForTest } from "../../src/ticks/runTick";
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
});
