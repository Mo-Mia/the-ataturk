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
import { withEngineConsoleMuted } from "@the-ataturk/engine/internal/silence";

import { ITERATIONS_PER_HALF } from "../config";

const LOG_HEAD_COUNT = 50;
const LOG_TAIL_COUNT = 50;

export type SmokeMatchResponse = Omit<MatchDetails, "iterationLog"> & {
  matchHistoryLog: string[];
};

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

function toSmokeMatchResponse(matchDetails: MatchDetails, fullLog: string[]): SmokeMatchResponse {
  const response: Partial<SmokeMatchResponse> = {
    ...matchDetails,
    matchHistoryLog: truncateLog(fullLog)
  };
  delete (response as { iterationLog?: string[] }).iterationLog;

  return response as SmokeMatchResponse;
}

async function runSmokeMatchInternal(): Promise<SmokeMatchResponse> {
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

  return toSmokeMatchResponse(matchDetails, fullLog);
}

/**
 * Run the deterministic legacy engine smoke-match fixture.
 *
 * @returns Match details without iterationLog plus a truncated match-history log.
 */
export async function runSmokeMatch(): Promise<SmokeMatchResponse> {
  return withEngineConsoleMuted(runSmokeMatchInternal);
}
