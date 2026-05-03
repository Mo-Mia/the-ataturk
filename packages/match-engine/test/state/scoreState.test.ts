import { describe, expect, it } from "vitest";

import { urgencyMultiplier } from "../../src/state/scoreState";
import { buildInitState } from "../../src/state/initState";
import { createTestConfigV2 } from "../helpers";

describe("score-state urgency", () => {
  it("increases urgency for a late trailing team and reduces it for a leading team", () => {
    const state = buildInitState({
      ...createTestConfigV2(701),
      duration: "full_90",
      dynamics: { fatigue: false, scoreState: true, autoSubs: false }
    });
    state.matchClock = { half: 2, minute: 86, seconds: 0 };
    state.score = { home: 0, away: 2 };

    expect(urgencyMultiplier(state, "home")).toBeGreaterThan(1);
    expect(urgencyMultiplier(state, "away")).toBeLessThan(1);
  });

  it("returns neutral urgency when score-state behaviour is disabled", () => {
    const state = buildInitState({
      ...createTestConfigV2(702),
      duration: "full_90",
      dynamics: { fatigue: false, scoreState: false, autoSubs: false }
    });
    state.matchClock = { half: 2, minute: 88, seconds: 0 };
    state.score = { home: 0, away: 3 };

    expect(urgencyMultiplier(state, "home")).toBe(1);
    expect(urgencyMultiplier(state, "away")).toBe(1);
  });
});
