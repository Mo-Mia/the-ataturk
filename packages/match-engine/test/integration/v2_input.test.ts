import { describe, expect, it } from "vitest";

import { simulateMatch } from "../../src";
import { createTestConfig, createTestConfigV2 } from "../helpers";

describe("v2 match input", () => {
  it("accepts v2 teams through the main simulateMatch entry point", () => {
    const snapshot = simulateMatch(createTestConfigV2(101, { preferredFoot: "either" }));

    expect(snapshot.ticks).toHaveLength(900);
    expect(snapshot.finalSummary.finalScore.home).toBeGreaterThanOrEqual(0);
    const goalkeeper = snapshot.meta.rosters.home[0];

    expect(goalkeeper?.preferredFoot).toBe("either");
    expect(goalkeeper?.weakFootRating).toBe(3);
    expect(goalkeeper?.skillMovesRating).toBe(1);
    expect(typeof goalkeeper?.attributesV2?.sprintSpeed).toBe("number");
    expect(typeof goalkeeper?.gkAttributesV2?.gkKicking).toBe("number");
  });

  it("keeps v1 input working through the same entry point", () => {
    const snapshot = simulateMatch(createTestConfig(102));

    expect(snapshot.ticks).toHaveLength(900);
    expect(snapshot.meta.rosters.home[0]).not.toHaveProperty("attributesV2");
  });

  it("is deterministic for the same v2 seed", () => {
    const config = createTestConfigV2(103, { preferredFoot: "left", weakFootRating: 3 });

    expect(simulateMatch(config)).toEqual(simulateMatch(config));
  });
});
