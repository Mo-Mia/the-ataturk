import { describe, expect, it } from "vitest";

import { awardCorner, awardPenalty, continuePendingSetPiece } from "../../src/resolution/setPieces";
import { buildInitState } from "../../src/state/initState";
import { createTestConfigV2 } from "../helpers";

describe("set-piece resolution", () => {
  it("selects deterministic takers from v2 attributes", () => {
    const config = createTestConfigV2(61);
    const widePlayer = config.homeTeam.players.find((player) => player.position === "RW")!;
    const centralPlayer = config.homeTeam.players.find((player) => player.position === "CM")!;
    const striker = config.homeTeam.players.find((player) => player.position === "ST")!;

    widePlayer.attributes.crossing = 99;
    widePlayer.attributes.vision = 95;
    centralPlayer.attributes.freeKickAccuracy = 99;
    centralPlayer.attributes.shotPower = 96;
    centralPlayer.attributes.curve = 94;
    striker.attributes.penalties = 99;
    striker.attributes.composure = 98;

    const state = buildInitState(config);

    expect(state.setPieceTakers.home.corner).toBe(widePlayer.id);
    expect(state.setPieceTakers.home.freeKick).toBe(centralPlayer.id);
    expect(state.setPieceTakers.home.penalty).toBe(striker.id);
  });

  it("emits corner-taken events and routes the delivery into the shot pipeline", () => {
    const state = buildInitState(createTestConfigV2(62));
    state.rng.int = () => 0;
    state.rng.next = () => 0;

    awardCorner(state, "home", [610, 1040], "deflected_shot", "away-2");

    expect(state.pendingSetPiece?.type).toBe("corner");
    expect(state.setPieceStats.home.corners).toBe(1);
    expect(state.stats.home.corners).toBe(1);
    expect(state.eventsThisTick.some((event) => event.type === "corner")).toBe(true);

    state.eventsThisTick = [];
    continuePendingSetPiece(state);
    continuePendingSetPiece(state);
    continuePendingSetPiece(state);

    expect(state.pendingSetPiece).toBeNull();
    expect(state.eventsThisTick.find((event) => event.type === "corner_taken")?.detail).toEqual(
      expect.objectContaining({ takerId: state.setPieceTakers.home.corner })
    );
    const shotDetail = state.eventsThisTick.find((event) => event.type === "shot")?.detail;
    expect(shotDetail?.setPieceContext).toEqual(expect.objectContaining({ type: "corner" }));
    expect(state.setPieceStats.home.setPieceShots).toBeGreaterThanOrEqual(1);
  });

  it("emits penalty-taken events and records set-piece shots", () => {
    const state = buildInitState(createTestConfigV2(63));
    const awayKeeper = state.players.find(
      (player) => player.teamId === "away" && player.baseInput.position === "GK"
    )!;
    awayKeeper.baseInput.attributes.saving = 0;
    state.rng.next = () => 0;

    awardPenalty(state, "home", "away-3", "home-9");

    expect(state.pendingSetPiece?.type).toBe("penalty");
    expect(state.setPieceStats.home.penalties).toBe(1);

    state.eventsThisTick = [];
    continuePendingSetPiece(state);
    continuePendingSetPiece(state);
    continuePendingSetPiece(state);

    expect(state.pendingSetPiece).toBeNull();
    expect(state.eventsThisTick.find((event) => event.type === "penalty_taken")?.detail).toEqual(
      expect.objectContaining({ takerId: state.setPieceTakers.home.penalty })
    );
    const shotDetail = state.eventsThisTick.find((event) => event.type === "shot")?.detail;
    expect(shotDetail?.setPieceContext).toEqual(expect.objectContaining({ type: "penalty" }));
    expect(state.setPieceStats.home.setPieceShots).toBeGreaterThanOrEqual(1);
  });
});
