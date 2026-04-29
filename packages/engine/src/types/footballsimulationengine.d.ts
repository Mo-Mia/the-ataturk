declare module "footballsimulationengine" {
  import type { MatchDetails, Pitch, TeamInput } from "../engine/types";

  export function initiateGame(
    team1: TeamInput,
    team2: TeamInput,
    pitch: Pitch
  ): Promise<MatchDetails>;

  export function playIteration(matchDetails: MatchDetails): Promise<MatchDetails>;

  export function startSecondHalf(matchDetails: MatchDetails): Promise<MatchDetails>;
}
