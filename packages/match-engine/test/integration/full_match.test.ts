import { describe, expect, it } from "vitest";

import { simulateMatch } from "../../src";
import { createTestConfig, createTestConfigV2 } from "../helpers";

describe("simulateMatch", () => {
  it("simulates a deterministic 1800-tick full match with a half-time marker", () => {
    const config = {
      ...createTestConfigV2(199, { preferredFoot: "either", weakFootRating: 5 }),
      duration: "full_90" as const,
      dynamics: { sideSwitch: true }
    };
    const first = simulateMatch(config);
    const second = simulateMatch(config);

    expect(first).toEqual(second);
    expect(first.ticks).toHaveLength(1800);
    expect(first.ticks[0]?.matchClock).toEqual({ half: 1, minute: 0, seconds: 3 });
    expect(first.ticks[899]?.matchClock).toEqual({ half: 1, minute: 45, seconds: 0 });
    expect(first.ticks[899]?.events.some((event) => event.type === "half_time")).toBe(true);
    expect(first.ticks[898]?.attackDirection).toEqual({ home: 1, away: -1 });
    expect(first.ticks[899]?.attackDirection).toEqual({ home: -1, away: 1 });
    expect(
      first.ticks[900]?.events.some(
        (event) => event.type === "kick_off" && event.team === "away" && event.detail?.secondHalf
      )
    ).toBe(true);
    expect(first.ticks.at(-1)?.matchClock).toEqual({ half: 2, minute: 90, seconds: 0 });
    expect(first.ticks.at(-1)?.events.at(-1)?.type).toBe("full_time");
  });

  it("simulates a deterministic 900-tick second half", () => {
    const first = simulateMatch(createTestConfig(99));
    const second = simulateMatch(createTestConfig(99));

    expect(first).toEqual(second);
    expect(first.ticks).toHaveLength(900);
    expect(first.ticks[0]?.matchClock).toEqual({ half: 2, minute: 45, seconds: 3 });
    expect(first.ticks[0]?.attackMomentum).toEqual({ home: 0, away: 0 });
    expect(first.ticks[0]?.possessionStreak?.teamId).toMatch(/^(home|away)$/);
    expect(first.ticks[0]?.possessionStreak?.ticks).toBe(1);
    const homeShape = first.ticks[0]?.diagnostics?.shape.home;
    expect(homeShape?.activePlayers).toBe(11);
    expect(typeof homeShape?.oppositionHalfPlayers).toBe("number");
    expect(typeof homeShape?.ballSidePlayers).toBe("number");
    expect(typeof homeShape?.lineHeight.team).toBe("number");
    expect(typeof homeShape?.spread.compactness).toBe("number");
    expect(typeof homeShape?.thirds.defensive).toBe("number");
    expect(first.ticks.at(-1)?.matchClock).toEqual({ half: 2, minute: 90, seconds: 0 });
    const fullTimeEvent = first.ticks.at(-1)?.events.at(-1);
    expect(fullTimeEvent?.type).toBe("full_time");
    expect(fullTimeEvent?.minute).toBe(90);
    expect(fullTimeEvent?.second).toBe(0);
    expect(fullTimeEvent?.detail?.finalScore).toEqual(first.finalSummary.finalScore);
    expect(first.finalSummary.finalScore.home).toBeGreaterThanOrEqual(0);
    expect(first.finalSummary.finalScore.away).toBeGreaterThanOrEqual(3);
  });

  it("never leaves a twice-booked player on the pitch", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const snapshot = simulateMatch(createTestConfig(seed));
      const yellowCounts = new Map<string, number>();
      const redPlayers = new Set<string>();

      snapshot.ticks.forEach((tick) => {
        tick.events.forEach((event) => {
          if (!event.playerId) {
            return;
          }
          if (event.type === "yellow") {
            yellowCounts.set(event.playerId, (yellowCounts.get(event.playerId) ?? 0) + 1);
          }
          if (event.type === "red") {
            redPlayers.add(event.playerId);
          }
        });

        const twiceBookedPlayers = [...yellowCounts.entries()]
          .filter(([, count]) => count >= 2)
          .map(([playerId]) => playerId);
        twiceBookedPlayers.forEach((playerId) => {
          expect(redPlayers.has(playerId), `seed ${seed}: ${playerId} has no red`).toBe(true);
          expect(
            tick.players.find((player) => player.id === playerId)?.onPitch,
            `seed ${seed}: ${playerId} stayed on the pitch`
          ).toBe(false);
          const sentOffTeam = tick.players.find((player) => player.id === playerId)?.teamId;
          if (sentOffTeam) {
            expect(
              tick.diagnostics?.shape[sentOffTeam].activePlayers,
              `seed ${seed}: diagnostics did not exclude ${playerId}`
            ).toBeLessThanOrEqual(10);
          }
        });
      });
    }
  });
});
