import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pitchFixture from "../fixtures/init_config/pitch.json";
import teamOneFixture from "../fixtures/init_config/team1.json";
import teamTwoFixture from "../fixtures/init_config/team2.json";
import {
  initiateGame,
  playIteration,
  startSecondHalf,
  type MatchDetails,
  type Pitch,
  type ShotStatistics,
  type TeamInput,
  type TeamStatistics
} from "../src";

const ITERATIONS_PER_HALF = 450;
const EXPECTED_ITERATIONS = ITERATIONS_PER_HALF * 2;

function cloneFixture<T>(fixture: unknown): T {
  return structuredClone(fixture) as T;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function assertBallWithinPitch(matchDetails: MatchDetails, pitch: Pitch): void {
  const [x, y] = matchDetails.ball.position;

  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(pitch.pitchWidth);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(pitch.pitchHeight);
}

function statValue(value: number | string | ShotStatistics): number {
  if (typeof value === "object") {
    return value.total;
  }

  return Number(value);
}

function hasAnyNonZeroStatistic(statistics: TeamStatistics): boolean {
  return Object.values(statistics).some((value) => statValue(value) > 0);
}

function shotCount(matchDetails: MatchDetails): number {
  return matchDetails.kickOffTeamStatistics.shots.total + matchDetails.secondTeamStatistics.shots.total;
}

function goals(matchDetails: MatchDetails): number {
  return (
    statValue(matchDetails.kickOffTeamStatistics.goals) +
    statValue(matchDetails.secondTeamStatistics.goals)
  );
}

function shotsOnTarget(matchDetails: MatchDetails): number {
  return matchDetails.kickOffTeamStatistics.shots.on + matchDetails.secondTeamStatistics.shots.on;
}

describe("footballsimulationengine smoke test", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(Math, "random").mockImplementation(createSeededRandom(3));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs a complete 900-iteration match with valid output", async () => {
    const teamOne: TeamInput = cloneFixture(teamOneFixture);
    const teamTwo: TeamInput = cloneFixture(teamTwoFixture);
    const pitch: Pitch = cloneFixture(pitchFixture);

    let matchDetails: MatchDetails = await initiateGame(teamOne, teamTwo, pitch);
    let iterationsRun = 0;

    assertBallWithinPitch(matchDetails, pitch);

    for (let iteration = 0; iteration < ITERATIONS_PER_HALF; iteration += 1) {
      matchDetails = await playIteration(matchDetails);
      iterationsRun += 1;
      assertBallWithinPitch(matchDetails, pitch);
    }

    matchDetails = await startSecondHalf(matchDetails);
    assertBallWithinPitch(matchDetails, pitch);

    for (let iteration = 0; iteration < ITERATIONS_PER_HALF; iteration += 1) {
      matchDetails = await playIteration(matchDetails);
      iterationsRun += 1;
      assertBallWithinPitch(matchDetails, pitch);
    }

    expect(iterationsRun).toBe(EXPECTED_ITERATIONS);
    expect(hasAnyNonZeroStatistic(matchDetails.kickOffTeamStatistics)).toBe(true);
    expect(hasAnyNonZeroStatistic(matchDetails.secondTeamStatistics)).toBe(true);
    expect(shotCount(matchDetails)).toBeGreaterThanOrEqual(6);
    expect(shotsOnTarget(matchDetails) > 0 || goals(matchDetails) > 0).toBe(true);
  });
});
