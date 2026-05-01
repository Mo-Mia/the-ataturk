import { describe, expect, it } from "vitest";

import { buildInitState } from "../../src/state/initState";
import { updateAttackMomentum } from "../../src/state/momentum";
import { createTestConfig } from "../helpers";

describe("attack momentum", () => {
  it("builds after progressive possession actions", () => {
    const state = buildInitState(createTestConfig(30));
    state.possession = { teamId: "home", zone: "mid", pressureLevel: "low" };
    state.eventsThisTick = [
      {
        type: "pass",
        team: "home",
        playerId: "home-6",
        minute: 50,
        second: 0,
        detail: {
          passType: "through_ball",
          complete: true,
          keyPass: true,
          progressive: true,
          targetPlayerId: "home-9"
        }
      },
      {
        type: "carry",
        team: "home",
        playerId: "home-5",
        minute: 50,
        second: 3,
        detail: { carryType: "flank_drive", progressive: true, flank: "right", zone: "att" }
      }
    ];

    updateAttackMomentum(state);

    expect(state.attackMomentum.home).toBeGreaterThan(12);
    expect(state.attackMomentum.away).toBe(0);
  });

  it("drops the previous team's momentum on possession change", () => {
    const state = buildInitState(createTestConfig(31));
    state.attackMomentum.home = 70;
    state.possessionStreak = { teamId: "home", ticks: 12 };
    state.possession = { teamId: "away", zone: "mid", pressureLevel: "medium" };
    state.eventsThisTick = [
      {
        type: "possession_change",
        team: "away",
        playerId: "away-7",
        minute: 55,
        second: 0,
        detail: { from: "home", to: "away", cause: "intercepted_pass", zone: "mid" }
      }
    ];

    updateAttackMomentum(state);

    expect(state.attackMomentum.home).toBeLessThan(30);
    expect(state.attackMomentum.away).toBeGreaterThan(0);
    expect(state.possessionStreak).toEqual({ teamId: "away", ticks: 1 });
  });
});
