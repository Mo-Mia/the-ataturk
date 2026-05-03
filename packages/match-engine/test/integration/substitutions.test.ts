import { describe, expect, it } from "vitest";

import { simulateMatch, type MatchConfigV2 } from "../../src";
import { createTestConfigV2, createTestPlayerV2 } from "../helpers";

describe("substitutions", () => {
  it("applies a scheduled manual substitution and keeps the removed player off the pitch", () => {
    const config = withBench(createTestConfigV2(601));
    const playerOut = config.homeTeam.players.find((player) => player.position !== "GK");
    const playerIn = config.homeTeam.bench?.find((player) => player.position !== "GK");

    expect(playerOut).toBeDefined();
    expect(playerIn).toBeDefined();

    const snapshot = simulateMatch({
      ...config,
      duration: "full_90",
      dynamics: { fatigue: true, scoreState: false, autoSubs: false },
      scheduledSubstitutions: [
        {
          teamId: "home",
          playerOutId: playerOut!.id,
          playerInId: playerIn!.id,
          minute: 65
        }
      ]
    });

    const substitution = snapshot.finalSummary.substitutions?.home[0];
    const finalTick = snapshot.ticks.at(-1);

    expect(substitution).toMatchObject({
      playerOutId: playerOut!.id,
      playerInId: playerIn!.id,
      reason: "manual",
      mode: "manual"
    });
    expect(finalTick?.players.find((player) => player.id === playerOut!.id)?.onPitch).toBe(false);
    expect(finalTick?.players.find((player) => player.id === playerIn!.id)?.onPitch).toBe(true);
    expect(
      snapshot.ticks.flatMap((tick) => tick.events).some((event) => event.type === "substitution")
    ).toBe(true);
  });

  it("uses the AI fatigue rule without exceeding the five-sub limit", () => {
    const config = withBench(createTestConfigV2(602));
    config.homeTeam.players = config.homeTeam.players.map((player) =>
      player.position === "GK"
        ? player
        : {
            ...player,
            attributes: { ...player.attributes, stamina: 1 }
          }
    );

    const snapshot = simulateMatch({
      ...config,
      duration: "full_90",
      dynamics: { fatigue: true, scoreState: false, autoSubs: true }
    });

    const substitutions = snapshot.finalSummary.substitutions?.home ?? [];

    expect(substitutions.length).toBeGreaterThan(0);
    expect(substitutions.length).toBeLessThanOrEqual(5);
    expect(substitutions.some((substitution) => substitution.reason === "auto-fatigue")).toBe(true);
  });

  it("rejects more than five scheduled substitutions", () => {
    const config = withBench(createTestConfigV2(603));

    expect(() =>
      simulateMatch({
        ...config,
        duration: "full_90",
        scheduledSubstitutions: config.homeTeam.players
          .filter((player) => player.position !== "GK")
          .slice(0, 6)
          .map((player, index) => ({
            teamId: "home" as const,
            playerOutId: player.id,
            playerInId: config.homeTeam.bench![index]!.id,
            minute: 60 + index
          }))
      })
    ).toThrow("home has more than 5 scheduled substitutions");
  });
});

function withBench(config: MatchConfigV2): MatchConfigV2 {
  return {
    ...config,
    homeTeam: {
      ...config.homeTeam,
      bench: benchPlayers("home-bench", 76)
    },
    awayTeam: {
      ...config.awayTeam,
      bench: benchPlayers("away-bench", 78)
    }
  };
}

function benchPlayers(prefix: string, base: number) {
  return ["GK", "CB", "LB", "CM", "AM", "RW", "ST", "ST"].map((position, index) =>
    createTestPlayerV2(
      `${prefix}-${index}`,
      `${prefix} ${index}`,
      `${position}${index + 12}`,
      position as Parameters<typeof createTestPlayerV2>[3],
      index + 12,
      base
    )
  );
}
