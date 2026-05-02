import { cleanup, render, screen } from "@testing-library/react";
import type { MatchSnapshot, MatchTick } from "@the-ataturk/match-engine";
import { afterEach, describe, expect, it } from "vitest";

import {
  HeatmapDiagnostics,
  HeatmapPitch,
  RelativePlayerHeatmaps,
  ShapeDiagnostics,
  buildHeatmap,
  buildRelativePlayerHeatmap
} from "../HeatmapPanel";

afterEach(() => {
  cleanup();
});

describe("HeatmapPanel", () => {
  it("builds and renders ball heatmaps with diagnostics", () => {
    const snapshot = createSnapshot();
    const heatmap = buildHeatmap(snapshot, "all", "ball");

    expect(heatmap.diagnostics.totalTicks).toBe(3);
    expect(heatmap.diagnostics.centralLanePct).toBe(33);
    expect(heatmap.diagnostics.leftFlankPct).toBe(33);
    expect(heatmap.diagnostics.rightFlankPct).toBe(33);
    expect(heatmap.diagnostics.attackingThirdPct).toBe(100);

    render(<HeatmapPitch snapshot={snapshot} filter="all" subject="ball" />);

    expect(screen.getByRole("img", { name: "Ball-position heatmap" })).toBeTruthy();
  });

  it("renders momentum and shape diagnostics", () => {
    const snapshot = createSnapshot();

    render(
      <HeatmapDiagnostics snapshot={snapshot} tick={snapshot.ticks[0]!} filter="all" subject="ball" />
    );

    expect(screen.getByText(/LIV momentum: 42/)).toBeTruthy();
    expect(screen.getByText(/streak: LIV 6 ticks/)).toBeTruthy();
    expect(screen.getByText("LIV active")).toBeTruthy();
    expect(screen.getByText("MIL active")).toBeTruthy();
    expect(screen.getByText("Attacking third")).toBeTruthy();
  });

  it("renders standalone shape diagnostics and relative player heatmaps", () => {
    const snapshot = createSnapshot();
    const relative = buildRelativePlayerHeatmap(snapshot, "h1");

    expect(relative.inPossession.samples).toBe(2);
    expect(relative.outOfPossession.samples).toBe(1);

    render(
      <>
        <ShapeDiagnostics snapshot={snapshot} tick={snapshot.ticks[0]!} />
        <RelativePlayerHeatmaps snapshot={snapshot} playerId="h1" />
      </>
    );

    expect(screen.getAllByText("Shape").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("img", { name: "Team in possession relative player heatmap" })
    ).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Team out of possession relative player heatmap" })
    ).toBeTruthy();
  });
});

function createSnapshot(): MatchSnapshot {
  const ticks: MatchTick[] = [
    tick(0, [340, 740, 0], "home", [
      { id: "h1", teamId: "home", position: [330, 720], hasBall: true, onPitch: true },
      { id: "a1", teamId: "away", position: [340, 500], hasBall: false, onPitch: true }
    ]),
    tick(1, [120, 760, 0], "home", [
      { id: "h1", teamId: "home", position: [140, 730], hasBall: true, onPitch: true },
      { id: "a1", teamId: "away", position: [220, 530], hasBall: false, onPitch: true }
    ]),
    tick(2, [530, 260, 0], "away", [
      { id: "h1", teamId: "home", position: [450, 530], hasBall: false, onPitch: true },
      { id: "a1", teamId: "away", position: [530, 260], hasBall: true, onPitch: true }
    ])
  ];

  return {
    meta: {
      homeTeam: { id: "liverpool", name: "Liverpool", shortName: "LIV" },
      awayTeam: { id: "milan", name: "Milan", shortName: "MIL" },
      rosters: {
        home: [{ id: "h1", name: "Home Forward", shortName: "HF", position: "ST" }],
        away: [{ id: "a1", name: "Away Forward", shortName: "AF", position: "ST" }]
      },
      seed: 1,
      duration: "second_half",
      preMatchScore: { home: 0, away: 0 },
      generatedAt: "2026-05-02T12:00:00.000Z",
      targets: {
        shotsTarget: [8, 12],
        goalsTarget: [1, 3],
        foulsTarget: [4, 8],
        cardsTarget: [1, 3],
        maxSingleScoreShare: 0.4
      }
    },
    ticks,
    finalSummary: {
      finalScore: { home: 0, away: 0 },
      statistics: {
        home: {
          goals: 0,
          shots: { total: 0, on: 0, off: 0, blocked: 0 },
          fouls: 0,
          yellowCards: 0,
          redCards: 0,
          corners: 0,
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
      }
    }
  };
}

function tick(
  iteration: number,
  ballPosition: [number, number, number],
  teamId: "home" | "away",
  players: MatchTick["players"]
): MatchTick {
  return {
    iteration,
    matchClock: { half: 2, minute: 45, seconds: iteration * 3 },
    ball: {
      position: ballPosition,
      inFlight: false,
      carrierPlayerId: teamId === "home" ? "h1" : "a1"
    },
    players,
    score: { home: 0, away: 0 },
    possession: { teamId, zone: "att" },
    attackMomentum: { home: 42, away: 9 },
    possessionStreak: { teamId: "home", ticks: 6 },
    diagnostics: {
      shape: {
        home: shapeDiagnostics(11, 430),
        away: shapeDiagnostics(11, 380)
      }
    },
    events: []
  };
}

function shapeDiagnostics(activePlayers: number, teamLine: number) {
  return {
    activePlayers,
    lineHeight: {
      team: teamLine,
      defence: teamLine - 120,
      midfield: teamLine,
      attack: teamLine + 130
    },
    spread: {
      width: 320,
      depth: 450,
      compactness: 170
    },
    thirds: {
      defensive: 3,
      middle: 5,
      attacking: 3
    },
    oppositionHalfPlayers: 4,
    ballSidePlayers: 6
  };
}
