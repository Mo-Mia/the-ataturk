import { describe, expect, it } from "vitest";

import { simulateMatch } from "../../src";
import { createTestConfig, createTestConfigV2 } from "../helpers";

describe("fatigue model", () => {
  it("leaves stamina untouched when fatigue is disabled", () => {
    const snapshot = simulateMatch({
      ...createTestConfigV2(501),
      duration: "full_90",
      dynamics: { fatigue: false, scoreState: false, autoSubs: false }
    });

    const stamina = snapshot.finalSummary.endStamina?.home ?? [];

    expect(stamina.length).toBeGreaterThan(0);
    expect(stamina.every((player) => player.stamina === 100)).toBe(true);
  });

  it("drains stamina over a full match when enabled", () => {
    const snapshot = simulateMatch({
      ...createTestConfigV2(502),
      duration: "full_90",
      dynamics: { fatigue: true, scoreState: false, autoSubs: false }
    });

    const stamina = snapshot.finalSummary.endStamina?.home ?? [];
    const average = stamina.reduce((sum, player) => sum + player.stamina, 0) / stamina.length;

    expect(average).toBeLessThan(85);
    expect(stamina.some((player) => player.stamina < 70)).toBe(true);
  });

  it("warns when v1 inputs use agility as the stamina surrogate", () => {
    const snapshot = simulateMatch({
      ...createTestConfig(503),
      duration: "full_90",
      dynamics: { fatigue: true, scoreState: false, autoSubs: false }
    });

    expect(snapshot.meta.diagnostics?.warnings).toContain(
      "One or more v1 players are using agility as the stamina surrogate; provide v2 stamina for calibrated fatigue diagnostics."
    );
  });
});
