import {
  initiateGame,
  playIteration,
  startSecondHalf,
  type MatchDetails,
  type Pitch,
  type TeamInput
} from "@the-ataturk/engine";
import pitchFixture from "@the-ataturk/engine/fixtures/init_config/pitch.json";
import teamOneFixture from "@the-ataturk/engine/fixtures/init_config/team1.json";
import teamTwoFixture from "@the-ataturk/engine/fixtures/init_config/team2.json";

import { ITERATIONS_PER_HALF } from "../config";

const LOG_HEAD_COUNT = 50;
const LOG_TAIL_COUNT = 50;

function cloneFixture<T>(fixture: unknown): T {
  return structuredClone(fixture) as T;
}

function truncateLog(log: string[]): string[] {
  if (log.length <= LOG_HEAD_COUNT + LOG_TAIL_COUNT) {
    return log;
  }

  return [...log.slice(0, LOG_HEAD_COUNT), ...log.slice(-LOG_TAIL_COUNT)];
}

async function runIteration(matchDetails: MatchDetails, fullLog: string[]): Promise<MatchDetails> {
  const nextMatchDetails = await playIteration(matchDetails);
  fullLog.push(...nextMatchDetails.iterationLog);
  return nextMatchDetails;
}

export async function runSmokeMatch(): Promise<MatchDetails> {
  const teamOne: TeamInput = cloneFixture(teamOneFixture);
  const teamTwo: TeamInput = cloneFixture(teamTwoFixture);
  const pitch: Pitch = cloneFixture(pitchFixture);
  const fullLog: string[] = [];

  let matchDetails = await initiateGame(teamOne, teamTwo, pitch);
  fullLog.push(...matchDetails.iterationLog);

  for (let iteration = 0; iteration < ITERATIONS_PER_HALF; iteration += 1) {
    matchDetails = await runIteration(matchDetails, fullLog);
  }

  matchDetails = await startSecondHalf(matchDetails);
  fullLog.push(...matchDetails.iterationLog);

  for (let iteration = 0; iteration < ITERATIONS_PER_HALF; iteration += 1) {
    matchDetails = await runIteration(matchDetails, fullLog);
  }

  return {
    ...matchDetails,
    iterationLog: truncateLog(fullLog)
  };
}
