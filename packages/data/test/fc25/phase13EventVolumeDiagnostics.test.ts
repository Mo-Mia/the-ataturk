import { describe, expect, it } from "vitest";

import {
  analyseEvents,
  definitionAudit,
  diagnosticRatios,
  summariseRuns,
  type EventVolumeMetrics
} from "../../src";
import type { MatchSnapshot, SemanticEvent } from "@the-ataturk/match-engine";

describe("Phase 13 event-volume diagnostic helpers", () => {
  it("documents definition equivalence and caveats", () => {
    const rows = definitionAudit();

    expect(rows.find((row) => row.metric === "shots")?.equivalence).toBe("equivalent");
    expect(rows.find((row) => row.metric === "cards")?.equivalence).toBe("minor-caveat");
    expect(rows.find((row) => row.metric === "corners")?.estimatedCorrection).toContain(
      "No definitional correction"
    );
  });

  it("classifies emitted snapshot events without inventing non-observable internals", () => {
    const events: SemanticEvent[] = [
      event("chance_created", "home", { source: "progressive_pass", convertedToShot: true }),
      event("chance_created", "home", { source: "cross", convertedToShot: false }),
      event("shot", "home", { chanceSource: "progressive_pass" }),
      event("shot", "home", { setPieceContext: { type: "corner" } }),
      event("shot", "away", {}),
      event("pass", "home", { passType: "cross", complete: true, progressive: true, keyPass: true }),
      event("pass", "home", { passType: "cutback", complete: true, progressive: false, keyPass: true }),
      event("free_kick", "home", { fouledBy: "a1" }),
      event("penalty_taken", "away", { takerId: "b1" }),
      event("possession_change", "away", { cause: "successful_tackle" }),
      event("corner", "home", { reason: "deflected_shot" }),
      event("corner", "away", { reason: "defensive_clearance" }),
      event("corner_taken", "home", { deliveryType: "in_swinger" }),
      event("throw_in", "home", { reason: "failed_pass" }),
      event("goal_kick", "away", {})
    ];

    const metrics = analyseEvents(events, snapshot({ shots: 3, goals: 1, fouls: 2, cards: 1, corners: 2 }), 7);

    expect(metrics.seed).toBe(7);
    expect(metrics.chanceCreated).toBe(2);
    expect(metrics.chanceConvertedToShot).toBe(1);
    expect(metrics.chanceConversionPct).toBe(50);
    expect(metrics.chanceShots).toBe(1);
    expect(metrics.setPieceShots).toBe(1);
    expect(metrics.openPlayCarrierShots).toBe(1);
    expect(metrics.progressivePasses).toBe(1);
    expect(metrics.keyPasses).toBe(2);
    expect(metrics.crosses).toBe(1);
    expect(metrics.cutbacks).toBe(1);
    expect(metrics.freeKicksAwarded).toBe(1);
    expect(metrics.penaltiesAwarded).toBe(1);
    expect(metrics.successfulTackles).toBe(1);
    expect(metrics.observableTackleResolutions).toBe(3);
    expect(metrics.foulShareOfObservableTackleResolutionsPct).toBeCloseTo(66.667, 3);
    expect(metrics.cornersFromDeflectedShots).toBe(1);
    expect(metrics.cornersFromDefensiveClearances).toBe(1);
    expect(metrics.cornerShots).toBe(1);
    expect(metrics.throwIns).toBe(1);
    expect(metrics.goalKicks).toBe(1);
  });

  it("summarises runs and derives diagnostic ratios", () => {
    const first = metrics({ shots: 10, chanceShots: 2, setPieceShots: 1, openPlayCarrierShots: 7 });
    const second = metrics({ shots: 14, chanceShots: 4, setPieceShots: 2, openPlayCarrierShots: 8 });

    const summary = summariseRuns([
      { seed: 1, ...first },
      { seed: 2, ...second }
    ]);
    const ratios = diagnosticRatios(summary.averages);

    expect(summary.averages.shots).toBe(12);
    expect(summary.standardErrors.shots).toBeCloseTo(2, 6);
    expect(ratios.chanceShotsSharePct).toBe(25);
    expect(ratios.setPieceShotsSharePct).toBe(12.5);
    expect(ratios.openPlayCarrierShotsSharePct).toBe(62.5);
  });
});

function event(
  type: SemanticEvent["type"],
  team: SemanticEvent["team"],
  detail: Record<string, unknown>
): SemanticEvent {
  return { type, team, minute: 1, second: 0, detail };
}

function snapshot(input: {
  shots: number;
  goals: number;
  fouls: number;
  cards: number;
  corners: number;
}): MatchSnapshot {
  return {
    finalSummary: {
      finalScore: { home: input.goals, away: 0 },
      statistics: {
        home: {
          goals: input.goals,
          shots: { total: input.shots, on: 1, off: 1, blocked: 1 },
          fouls: input.fouls,
          yellowCards: input.cards,
          redCards: 0,
          corners: input.corners,
          possession: 50
        },
        away: {
          goals: 0,
          shots: { total: 0, on: 0, off: 0, blocked: 0 },
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          corners: 0,
          possession: 50
        }
      },
      setPieces: {
        home: {
          corners: input.corners,
          directFreeKicks: 1,
          indirectFreeKicks: 0,
          penalties: 0,
          setPieceShots: 1,
          setPieceGoals: 0
        },
        away: {
          corners: 0,
          directFreeKicks: 0,
          indirectFreeKicks: 0,
          penalties: 1,
          setPieceShots: 0,
          setPieceGoals: 0
        }
      }
    }
  } as MatchSnapshot;
}

function metrics(overrides: Partial<EventVolumeMetrics>): EventVolumeMetrics {
  return {
    shots: 0,
    goals: 0,
    shotConversionPct: 0,
    onTargetShots: 0,
    offTargetShots: 0,
    blockedShots: 0,
    chanceCreated: 0,
    chanceConvertedToShot: 0,
    chanceConversionPct: 0,
    chanceShots: 0,
    setPieceShots: 0,
    openPlayCarrierShots: 0,
    passes: 0,
    progressivePasses: 0,
    keyPasses: 0,
    crosses: 0,
    cutbacks: 0,
    fouls: 0,
    freeKicksAwarded: 0,
    penaltiesAwarded: 0,
    successfulTackles: 0,
    observableTackleResolutions: 0,
    foulShareOfObservableTackleResolutionsPct: 0,
    cards: 0,
    corners: 0,
    cornersFromDeflectedShots: 0,
    cornersFromDefensiveClearances: 0,
    cornerTaken: 0,
    cornerShots: 0,
    cornerShotConversionPct: 0,
    setPieceGoals: 0,
    throwIns: 0,
    goalKicks: 0,
    ...overrides
  };
}
