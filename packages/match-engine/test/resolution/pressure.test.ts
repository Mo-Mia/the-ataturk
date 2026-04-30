import { describe, expect, it } from "vitest";

import { buildInitState } from "../../src/state/initState";
import { pressureLevel, rollPressureTackle } from "../../src/resolution/pressure";
import { resolveTackleAttempt } from "../../src/resolution/actions/tackle";
import { createTestConfig } from "../helpers";

describe("pressure and tackle resolution", () => {
  it("classifies nearby defenders as pressure", () => {
    const state = buildInitState(createTestConfig(2));
    const carrier = state.players.find((player) => player.hasBall)!;
    const defender = state.players.find((player) => player.teamId !== carrier.teamId)!;
    state.players
      .filter((player) => player.teamId !== carrier.teamId)
      .forEach((player) => {
        player.position = [0, 0];
      });
    defender.position = [carrier.position[0] + 10, carrier.position[1] + 10];

    expect(pressureLevel(state, carrier)).toBe("medium");
  });

  it("uses linear tackling attributes in tackle attempts", () => {
    const weak = buildInitState(createTestConfig(3));
    const strong = buildInitState(createTestConfig(3));
    const weakCarrier = weak.players.find((player) => player.hasBall)!;
    const strongCarrier = strong.players.find((player) => player.hasBall)!;
    const weakDefender = weak.players.find((player) => player.teamId !== weakCarrier.teamId)!;
    const strongDefender = strong.players.find((player) => player.teamId !== strongCarrier.teamId)!;

    weakDefender.position = [weakCarrier.position[0] + 5, weakCarrier.position[1]];
    strongDefender.position = [strongCarrier.position[0] + 5, strongCarrier.position[1]];
    weakDefender.baseInput.attributes.tackling = 0;
    strongDefender.baseInput.attributes.tackling = 100;
    weak.possession.pressureLevel = "high";
    strong.possession.pressureLevel = "high";

    expect(rollPressureTackle(weak, weakCarrier)).toBe(false);
    expect(() => rollPressureTackle(strong, strongCarrier)).not.toThrow();
  });

  it("sends a player off for a second yellow card", () => {
    const state = buildInitState(createTestConfig(4));
    const carrier = state.players.find((player) => player.hasBall)!;
    const tackler = state.players.find((player) => player.teamId !== carrier.teamId)!;
    tackler.yellowCards = 1;
    state.possession.pressureLevel = "high";
    state.rng.next = () => 0;

    const outcome = resolveTackleAttempt(state, tackler, carrier);

    expect(outcome).toBe("foul");
    expect(tackler.onPitch).toBe(false);
    expect(tackler.redCard).toBe(true);
    expect(state.eventsThisTick.map((event) => event.type)).toEqual(["foul", "yellow", "red"]);
    expect(state.eventsThisTick.at(-1)?.detail?.reason).toBe("second_yellow");
  });
});
