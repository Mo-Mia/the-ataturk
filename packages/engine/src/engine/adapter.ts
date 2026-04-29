import { createRequire } from "node:module";

import type { FootballSimulationEngineModule, MatchDetails, Pitch, TeamInput } from "./types";

const require = createRequire(import.meta.url);
const loadedEngine = require("footballsimulationengine") as unknown;
const engine = loadedEngine as FootballSimulationEngineModule;

export function initiateGame(
  team1: TeamInput,
  team2: TeamInput,
  pitch: Pitch
): Promise<MatchDetails> {
  return engine.initiateGame(team1, team2, pitch);
}

export function playIteration(matchDetails: MatchDetails): Promise<MatchDetails> {
  return engine.playIteration(matchDetails);
}

export function startSecondHalf(matchDetails: MatchDetails): Promise<MatchDetails> {
  return engine.startSecondHalf(matchDetails);
}
