import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ACTION_WEIGHTS,
  CHANCE_CREATION,
  FATIGUE,
  SET_PIECES,
  SUBSTITUTIONS,
  SUCCESS_PROBABILITIES
} from "../../src/calibration/probabilities";
import { selectCarrierAction } from "../../src/resolution/carrierAction";
import { resolveTackleAttempt } from "../../src/resolution/actions/tackle";
import { maybeCreateChanceFromPass } from "../../src/resolution/chanceCreation";
import { awardCorner, continuePendingSetPiece } from "../../src/resolution/setPieces";
import { simulateMatch, type MatchConfigV2 } from "../../src";
import { buildInitState } from "../../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../../src/state/matchState";
import { createTestConfigV2, createTestPlayerV2 } from "../helpers";

describe.sequential("calibration sensitivity", () => {
  let snapshot: CalibrationSnapshot;

  beforeEach(() => {
    snapshot = takeSnapshot();
  });

  afterEach(() => {
    restoreSnapshot(snapshot);
  });

  it("documents seed-count convention for behavioural sensitivity tests", () => {
    const seedCountConvention = {
      lowVariance: "50-200 seeds",
      mediumVariance: "500 seeds",
      highVariancePersonnel: "1000+ paired seeds"
    };

    expect(seedCountConvention.highVariancePersonnel).toContain("1000");
  });

  it("lets foundational carrier action weights dominate selected actions in an isolated state", () => {
    const state = carrierState();
    const carrier = currentCarrier(state);
    state.rng.next = () => 0.5;
    ACTION_WEIGHTS.att.low = { pass: 0, dribble: 0, hold: 0, clear: 0, shoot: 1 };

    expect(selectCarrierAction(state, carrier)).toBe("shoot");

    ACTION_WEIGHTS.att.low = { pass: 1, dribble: 0, hold: 0, clear: 0, shoot: 0 };
    expect(selectCarrierAction(state, carrier)).toBe("pass");
  });

  it("lets foundational tackle and foul probabilities alter tackle outcomes", () => {
    const foulState = carrierState();
    const carrier = currentCarrier(foulState);
    const tackler = opponentOutfielder(foulState);
    foulState.possession.pressureLevel = "high";
    foulState.rng.next = () => 0;
    SUCCESS_PROBABILITIES.foulOnTackleByPressure.high = 1;

    expect(resolveTackleAttempt(foulState, tackler, carrier)).toBe("foul");

    const wonState = carrierState();
    const wonCarrier = currentCarrier(wonState);
    const wonTackler = opponentOutfielder(wonState);
    wonState.possession.pressureLevel = "high";
    wonState.rng.next = sequence([1, 0]);
    SUCCESS_PROBABILITIES.foulOnTackleByPressure.high = 0;
    SUCCESS_PROBABILITIES.tackleSuccessBase = 1;
    wonTackler.baseInput.attributes.tackling = 100;

    expect(resolveTackleAttempt(wonState, wonTackler, wonCarrier)).toBe("won");
  });

  it("responds when fatigue baseline drain is increased", () => {
    const baselineAverage = averageEndStamina();
    FATIGUE.baselineDrainPerTick *= 1.5;

    expect(averageEndStamina()).toBeLessThan(baselineAverage - 5);
  });

  it("responds when the AI substitution fatigue threshold is raised", () => {
    SUBSTITUTIONS.fatigueThreshold = 0;
    const lowThresholdSubs = substitutionCount();

    SUBSTITUTIONS.fatigueThreshold = 100;
    const highThresholdSubs = substitutionCount();

    expect(highThresholdSubs).toBeGreaterThan(lowThresholdSubs);
  });

  it("lets chance-creation source probability gate attacking-third shots", () => {
    CHANCE_CREATION.sourceBase.through_ball = 0;
    const noChanceState = carrierState();
    const noChanceCarrier = currentCarrier(noChanceState);
    noChanceState.rng.next = () => 0.5;

    expect(
      maybeCreateChanceFromPass(noChanceState, noChanceCarrier, noChanceCarrier, {
        passType: "through_ball",
        progressive: true,
        keyPass: true
      })
    ).toBe(false);
    expect(noChanceState.stats.home.shots.total).toBe(0);

    CHANCE_CREATION.sourceBase.through_ball = 1;
    const chanceState = carrierState();
    const chanceCarrier = currentCarrier(chanceState);
    chanceState.rng.next = () => 0.5;

    expect(
      maybeCreateChanceFromPass(chanceState, chanceCarrier, chanceCarrier, {
        passType: "through_ball",
        progressive: true,
        keyPass: true
      })
    ).toBe(true);
    expect(chanceState.stats.home.shots.total).toBeGreaterThan(0);
  });

  it("lets corner shot calibration alter whether a corner reaches the shot pipeline", () => {
    SET_PIECES.cornerShotBase = 0;
    const looseState = cornerState();
    looseState.rng.next = () => 0.5;
    resolvePendingCorner(looseState);

    expect(looseState.setPieceStats.home.setPieceShots).toBe(0);

    SET_PIECES.cornerShotBase = 1;
    const shotState = cornerState();
    shotState.rng.next = () => 0.5;
    resolvePendingCorner(shotState);

    expect(shotState.setPieceStats.home.setPieceShots).toBeGreaterThan(0);
  });
});

interface CalibrationSnapshot {
  actionWeights: typeof ACTION_WEIGHTS;
  successProbabilities: typeof SUCCESS_PROBABILITIES;
  fatigue: typeof FATIGUE;
  substitutions: typeof SUBSTITUTIONS;
  chanceCreation: typeof CHANCE_CREATION;
  setPieces: typeof SET_PIECES;
}

function takeSnapshot(): CalibrationSnapshot {
  return {
    actionWeights: structuredClone(ACTION_WEIGHTS),
    successProbabilities: structuredClone(SUCCESS_PROBABILITIES),
    fatigue: structuredClone(FATIGUE),
    substitutions: structuredClone(SUBSTITUTIONS),
    chanceCreation: structuredClone(CHANCE_CREATION),
    setPieces: structuredClone(SET_PIECES)
  };
}

function restoreSnapshot(snapshot: CalibrationSnapshot): void {
  restoreObject(ACTION_WEIGHTS, snapshot.actionWeights);
  restoreObject(SUCCESS_PROBABILITIES, snapshot.successProbabilities);
  restoreObject(FATIGUE, snapshot.fatigue);
  restoreObject(SUBSTITUTIONS, snapshot.substitutions);
  restoreObject(CHANCE_CREATION, snapshot.chanceCreation);
  restoreObject(SET_PIECES, snapshot.setPieces);
}

function restoreObject<T extends object>(target: T, source: T): void {
  for (const key of Object.keys(target)) {
    delete (target as Record<string, unknown>)[key];
  }
  Object.assign(target, structuredClone(source));
}

function carrierState(): MutableMatchState {
  const state = buildInitState({
    ...createTestConfigV2(810),
    duration: "full_90",
    dynamics: {
      fatigue: false,
      scoreState: false,
      autoSubs: false,
      chanceCreation: true,
      setPieces: true
    }
  });
  const carrier = state.players.find(
    (player) => player.teamId === "home" && player.baseInput.position === "ST"
  )!;
  carrier.hasBall = true;
  carrier.position = [340, 910];
  carrier.baseInput.attributes = {
    ...carrier.baseInput.attributes,
    passing: 100,
    shooting: 100,
    control: 100,
    perception: 100
  };
  state.ball.carrierPlayerId = carrier.id;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
  return state;
}

function cornerState(): MutableMatchState {
  const state = carrierState();
  awardCorner(state, "home", [610, 1040], "deflected_shot", currentCarrier(state).id);
  return state;
}

function resolvePendingCorner(state: MutableMatchState): void {
  continuePendingSetPiece(state);
  continuePendingSetPiece(state);
  continuePendingSetPiece(state);
}

function currentCarrier(state: MutableMatchState): MutablePlayer {
  return state.players.find((player) => player.hasBall)!;
}

function opponentOutfielder(state: MutableMatchState): MutablePlayer {
  return state.players.find(
    (player) => player.teamId === "away" && player.baseInput.position !== "GK"
  )!;
}

function averageEndStamina(): number {
  const snapshot = simulateMatch({
    ...createTestConfigV2(811),
    duration: "full_90",
    dynamics: { fatigue: true, scoreState: false, autoSubs: false }
  });
  const stamina = snapshot.finalSummary.endStamina!.home;
  return stamina.reduce((sum, player) => sum + player.stamina, 0) / stamina.length;
}

function substitutionCount(): number {
  const config = withBench(createTestConfigV2(812));
  const snapshot = simulateMatch({
    ...config,
    duration: "full_90",
    dynamics: { fatigue: true, scoreState: false, autoSubs: true }
  });
  return (
    (snapshot.finalSummary.substitutions?.home.length ?? 0) +
    (snapshot.finalSummary.substitutions?.away.length ?? 0)
  );
}

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

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
}
