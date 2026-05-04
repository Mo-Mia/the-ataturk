import { describe, expect, it } from "vitest";

import { performShot } from "../../src/resolution/actions/shot";
import { buildInitState } from "../../src/state/initState";
import type { StarRating } from "../../src";
import { createTestConfig, createTestConfigV2 } from "../helpers";

describe("preferred-foot shot handling", () => {
  it("keeps v1 shots on the legacy no-modifier foot path", () => {
    const state = buildInitState(createTestConfig(201));
    const shooter = prepareShooter(state);
    const rolls = [0, 1];
    state.rng.next = () => rolls.shift() ?? 1;

    performShot(state, shooter);

    expect(state.eventsThisTick.find((event) => event.type === "shot")?.detail).toMatchObject({
      foot: "preferred"
    });
  });

  it("uses the 3-star 75/25 preferred-foot split for v2 players", () => {
    const footCounts = countShotFeet(3, 400);
    const weakShare = footCounts.weak / (footCounts.preferred + footCounts.weak);

    expect(weakShare).toBeGreaterThan(0.18);
    expect(weakShare).toBeLessThan(0.32);
  });

  it("makes 1-star weak-foot shots materially worse and 5-star weak-foot shots equivalent", () => {
    const trials = 800;
    const oneStarPreferred = conversionRate(1, "preferred", trials);
    const oneStarWeak = conversionRate(1, "weak", trials);
    const oneStarReduction = (oneStarPreferred - oneStarWeak) / oneStarPreferred;

    const fiveStarPreferred = conversionRate(5, "preferred", trials);
    const fiveStarWeak = conversionRate(5, "weak", trials);
    const fiveStarDelta = Math.abs(fiveStarPreferred - fiveStarWeak);

    expect(oneStarReduction).toBeGreaterThanOrEqual(0.35);
    expect(oneStarReduction).toBeLessThanOrEqual(0.9);
    expect(oneStarWeak).toBeGreaterThan(0.03);
    expect(fiveStarDelta).toBeLessThanOrEqual(0.05);
  });
});

function countShotFeet(
  weakFootRating: StarRating,
  seeds: number
): Record<"preferred" | "weak", number> {
  const counts = { preferred: 0, weak: 0 };

  for (let seed = 1; seed <= seeds; seed += 1) {
    const state = buildInitState(
      createTestConfigV2(seed, { preferredFoot: "left", weakFootRating })
    );
    const shooter = prepareShooter(state);
    const rolls = [pseudoRandom(seed, 3), 1];
    state.rng.next = () => rolls.shift() ?? 1;
    performShot(state, shooter);
    const foot = state.eventsThisTick.find((event) => event.type === "shot")?.detail?.foot;
    if (foot === "preferred" || foot === "weak") {
      counts[foot] += 1;
    }
  }

  return counts;
}

function conversionRate(
  weakFootRating: StarRating,
  foot: "preferred" | "weak",
  trials: number
): number {
  let goals = 0;

  for (let trial = 0; trial < trials; trial += 1) {
    const state = buildInitState(
      createTestConfigV2(301, { preferredFoot: "left", weakFootRating })
    );
    const shooter = prepareShooter(state);
    const footRoll = foot === "preferred" ? 0 : 1;
    const rolls = [footRoll, pseudoRandom(trial, 1), pseudoRandom(trial, 2)];
    state.rng.next = () => rolls.shift() ?? 1;

    performShot(state, shooter);
    if (state.eventsThisTick.some((event) => event.type === "goal_scored")) {
      goals += 1;
    }
  }

  return goals / trials;
}

function prepareShooter(state: ReturnType<typeof buildInitState>) {
  const shooter = state.players.find(
    (player) => player.teamId === "home" && player.baseInput.position === "ST"
  );
  const keeper = state.players.find(
    (player) => player.teamId === "away" && player.baseInput.position === "GK"
  );

  if (!shooter || !keeper) {
    throw new Error("Expected test teams to include a home striker and away goalkeeper");
  }

  shooter.position = [340, 930];
  shooter.baseInput.attributes.shooting = 86;
  shooter.baseInput.attributes.jumping = 40;
  keeper.baseInput.attributes.saving = 100;
  state.players.forEach((player) => {
    player.hasBall = player.id === shooter.id;
  });
  state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };

  return shooter;
}

function pseudoRandom(index: number, salt: number): number {
  return ((index * 9301 + salt * 49297) % 233280) / 233280;
}
