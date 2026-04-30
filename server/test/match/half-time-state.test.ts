import { createDatasetVersion, getDb } from "@the-ataturk/data";
import { playIteration, type MatchDetails } from "@the-ataturk/engine";
import { withEngineConsoleMuted } from "@the-ataturk/engine/internal/silence";
import { afterEach, describe, expect, it } from "vitest";

import {
  LIVERPOOL_SECOND_HALF_XI,
  MILAN_SECOND_HALF_XI,
  buildHalfTimeMatchState
} from "../../src/match/half-time-state";
import { createServerTestDatabase, type TestDatabase } from "../admin/test-db";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

function setupDerivedDataset(): void {
  const db = getDb(testDatabase?.path);
  createDatasetVersion(
    { id: "v2-llm-derived-final", name: "Derived test", parent_version_id: "v0-stub" },
    db
  );

  const starters = [...LIVERPOOL_SECOND_HALF_XI, ...MILAN_SECOND_HALF_XI];
  const updateAttributes = db.prepare<[string]>(
    `
      UPDATE player_attributes
      SET passing = 72,
          shooting = 70,
          tackling = 71,
          saving = 12,
          agility = 73,
          strength = 74,
          penalty_taking = 65,
          perception = 75,
          jumping = 72,
          control = 76,
          generated_by = 'test',
          generated_at = '2026-04-30T00:00:00.000Z',
          updated_at = '2026-04-30T00:00:00.000Z'
      WHERE dataset_version = 'v2-llm-derived-final'
        AND player_id = ?
    `
  );

  for (const playerId of starters) {
    updateAttributes.run(playerId);
  }

  db.prepare(
    `
      UPDATE player_attributes
      SET saving = 82
      WHERE dataset_version = 'v2-llm-derived-final'
        AND player_id IN ('jerzy-dudek', 'dida')
    `
  ).run();
}

function allPlayers(matchDetails: MatchDetails) {
  return [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players];
}

function allSkillsAreNonZero(matchDetails: MatchDetails): boolean {
  return allPlayers(matchDetails).every((player) =>
    Object.values(player.skill).every((value) => Number(value) > 0)
  );
}

describe("buildHalfTimeMatchState", () => {
  it("builds a deterministic second-half kickoff state from the database", async () => {
    testDatabase = createServerTestDatabase("half-time-state");
    setupDerivedDataset();

    const first = await buildHalfTimeMatchState(
      "liverpool",
      "ac-milan",
      "v2-llm-derived-final"
    );
    const second = await buildHalfTimeMatchState(
      "liverpool",
      "ac-milan",
      "v2-llm-derived-final"
    );

    expect(first).toEqual(second);
    expect(first.matchID).toBe("final-2005:liverpool-v-ac-milan:v2-llm-derived-final:second-half");
    expect(first.half).toBe(2);
    expect(first.kickOffTeam.name).toBe("Liverpool");
    expect(first.secondTeam.name).toBe("AC Milan");
    expect(first.kickOffTeamStatistics.goals).toBe(0);
    expect(first.secondTeamStatistics.goals).toBe(3);
    expect(first.kickOffTeam.players).toHaveLength(11);
    expect(first.secondTeam.players).toHaveLength(11);
    expect(first.ball.position).toEqual([340, 525, 0]);
    expect(first.ball.withTeam).toBe("liverpool");
    expect(first.ball.withPlayer).toBe(true);
    expect(first.kickOffTeam.players.map((player) => player.playerID)).toEqual(
      LIVERPOOL_SECOND_HALF_XI
    );
    expect(first.secondTeam.players.map((player) => player.playerID)).toEqual(
      MILAN_SECOND_HALF_XI
    );
    expect(allSkillsAreNonZero(first)).toBe(true);

    for (const player of allPlayers(first)) {
      expect(player.currentPOS[0]).toBeGreaterThanOrEqual(0);
      expect(player.currentPOS[0]).toBeLessThanOrEqual(680);
      expect(player.currentPOS[1]).toBeGreaterThanOrEqual(0);
      expect(player.currentPOS[1]).toBeLessThanOrEqual(1050);
      expect(player.fitness).toBe(92);
    }
  });

  it("produces a state the engine can resume with playIteration", async () => {
    testDatabase = createServerTestDatabase("half-time-state-iteration");
    setupDerivedDataset();

    const matchDetails = await buildHalfTimeMatchState(
      "liverpool",
      "ac-milan",
      "v2-llm-derived-final"
    );
    const next = await withEngineConsoleMuted(() => playIteration(matchDetails));

    expect(next.half).toBe(2);
    expect(next.ball.position[0]).toBeGreaterThanOrEqual(0);
    expect(next.ball.position[0]).toBeLessThanOrEqual(680);
    expect(next.ball.position[1]).toBeGreaterThanOrEqual(0);
    expect(next.ball.position[1]).toBeLessThanOrEqual(1050);
  });
});
