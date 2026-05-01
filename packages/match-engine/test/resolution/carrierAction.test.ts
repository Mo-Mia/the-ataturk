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
    const failedPassDetail = state.eventsThisTick.find((event) => event.type === "pass")?.detail;
    expect(failedPassDetail).toMatchObject({ complete: false });
    expect(typeof failedPassDetail?.targetPlayerId).toBe("string");
    expect(
      state.eventsThisTick.find((event) => event.type === "possession_change")?.detail
    ).toEqual(
      expect.objectContaining({ cause: "restart_throw_in", previousPossessor: carrier.id })
    );
    expect(state.ball.position[0] === 0 || state.ball.position[0] === 680).toBe(true);
    expect(state.pendingSetPiece?.type).toBe("throw_in");
    expect(state.ball.carrierPlayerId).toBeNull();
    expect(state.players.some((player) => player.hasBall)).toBe(false);

    runTick(state);
    runTick(state);
    runTick(state);

    expect(state.pendingSetPiece).toBeNull();
    expect(state.ball.inFlight).toBe(true);
  });

  it("emits rich selective pass events for progressive passes", () => {
    const state = buildInitState(createTestConfig(16));
    const carrier = state.players.find((player) => player.hasBall)!;
    const target = state.players.find(
      (player) =>
        player.teamId === carrier.teamId &&
        player.id !== carrier.id &&
        player.baseInput.position === "ST"
    )!;
    state.players.forEach((player) => {
      player.onPitch = player.id === carrier.id || player.id === target.id;
    });
    carrier.position = [340, 520];
    target.position = [340, 780];
    carrier.baseInput.attributes.passing = 100;
    state.possession = { teamId: carrier.teamId, zone: "mid", pressureLevel: "low" };
    state.rng.next = () => 0;

    performPass(state, carrier);

    expect(state.eventsThisTick.find((event) => event.type === "pass")?.detail).toEqual(
      expect.objectContaining({
        passType: "through_ball",
        complete: true,
        keyPass: true,
        progressive: true,
        targetPlayerId: target.id
      })
    );
  });

  it("discourages repetitive passes between the two central strikers", () => {
    const state = buildInitState(createTestConfig(17));
    const strikers = state.players.filter(
      (player) => player.teamId === "home" && player.baseInput.position === "ST"
    );
    const carrier = strikers[0]!;
    const otherStriker = strikers[1]!;
    const midfielder = state.players.find(
      (player) => player.teamId === "home" && player.baseInput.position === "CM"
    )!;

    state.players.forEach((player) => {
      player.onPitch = [carrier.id, otherStriker.id, midfielder.id].includes(player.id);
      player.hasBall = player.id === carrier.id;
    });
    carrier.position = [340, 700];
    otherStriker.position = [342, 760];
    midfielder.position = [230, 760];
    carrier.baseInput.attributes.passing = 100;
    state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
    state.rng.int = () => 0;
    state.rng.next = () => 0;

    performPass(state, carrier);

    expect(midfielder.hasBall).toBe(true);
    expect(otherStriker.hasBall).toBe(false);
  });

  it("penalises long-range shot selection", () => {
    const near = shotDistanceContext("home", [340, 930]);
    const far = shotDistanceContext("home", [340, 710]);

    expect(near.actionWeight).toBeGreaterThan(far.actionWeight);
    expect(near.onTarget).toBeGreaterThan(far.onTarget);
  });

  it("emits a goal event, pauses, then gives the conceding team kick-off", () => {
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

    expect(state.pendingGoal?.restartTeam).toBe("away");
    expect(state.ball.position).toEqual([340, 1050, 0]);
    expect(state.ball.carrierPlayerId).toBeNull();
    expect(state.players.some((player) => player.hasBall)).toBe(false);
    expect(state.eventsThisTick.some((event) => event.type === "goal_scored")).toBe(true);
    const shotDetail = state.eventsThisTick.find((event) => event.type === "shot")?.detail;
    expect(shotDetail).toMatchObject({ pressure: "low" });
    expect(typeof shotDetail?.shotType).toBe("string");
    expect(typeof shotDetail?.distancePitchUnits).toBe("number");
    expect(typeof shotDetail?.distanceToGoalMetres).toBe("number");

    for (let tick = 0; tick < 4; tick += 1) {
      runTick(state);
      expect(state.pendingGoal).not.toBeNull();
      expect(state.ball.position).toEqual([340, 525, 0]);
      expect(state.players.some((player) => player.hasBall)).toBe(false);
    }

    runTick(state);

    expect(state.pendingGoal).toBeNull();
    expect(state.eventsThisTick).toContainEqual(
      expect.objectContaining({ type: "kick_off", team: "away" })
    );
    expect(
      state.eventsThisTick.find(
        (event) => event.type === "possession_change" && event.team === "away"
      )?.detail
    ).toMatchObject({ cause: "kickoff_after_goal", previousPossessor: shooter.id });
    expect(state.eventsThisTick).not.toContainEqual(
      expect.objectContaining({ type: "kick_off", team: "home" })
    );
    expect(state.ball.position[0]).toBe(340);
    expect(state.ball.position[1]).toBeGreaterThan(525);
  });

  it("delays an off-target shot goal kick restart", () => {
    const state = buildInitState(createTestConfig(23));
    const shooter = state.players.find(
      (player) => player.teamId === "home" && player.baseInput.position === "ST"
    )!;
    shooter.position = [340, 930];
    state.players.forEach((player) => {
      player.hasBall = player.id === shooter.id;
    });
    state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
    state.rng.next = () => 1;

    performShot(state, shooter);

    expect(state.eventsThisTick.some((event) => event.type === "goal_kick")).toBe(true);
    expect(
      state.eventsThisTick.find((event) => event.type === "possession_change")?.detail
    ).toEqual(
      expect.objectContaining({ cause: "restart_goal_kick", previousPossessor: shooter.id })
    );
    expect(state.pendingSetPiece?.type).toBe("goal_kick");
    expect(state.ball.carrierPlayerId).toBeNull();
    expect(state.players.some((player) => player.hasBall)).toBe(false);
  });

  it("emits save quality and possession cause when the goalkeeper saves", () => {
    const state = buildInitState(createTestConfig(24));
    const shooter = state.players.find(
      (player) => player.teamId === "home" && player.baseInput.position === "ST"
    )!;
    const keeper = state.players.find(
      (player) => player.teamId === "away" && player.baseInput.position === "GK"
    )!;
    shooter.position = [340, 930];
    keeper.baseInput.attributes.saving = 100;
    state.players.forEach((player) => {
      player.hasBall = player.id === shooter.id;
    });
    state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
    state.rng.next = () => 0;

    performShot(state, shooter);

    const saveDetail = state.eventsThisTick.find((event) => event.type === "save")?.detail;
    expect(typeof saveDetail?.quality).toBe("string");
    expect(typeof saveDetail?.result).toBe("string");
    expect(
      state.eventsThisTick.find((event) => event.type === "possession_change")?.detail
    ).toEqual(expect.objectContaining({ cause: "goalkeeper_save", previousPossessor: shooter.id }));
  });
});
