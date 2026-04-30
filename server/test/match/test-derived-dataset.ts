import { createDatasetVersion, getDb } from "@the-ataturk/data";

import {
  LIVERPOOL_SECOND_HALF_XI,
  MILAN_SECOND_HALF_XI
} from "../../src/match/half-time-state";

export const TEST_DERIVED_DATASET_VERSION = "v2-llm-derived-final";

export function setupTestDerivedDataset(databasePath: string | undefined): void {
  const db = getDb(databasePath);
  createDatasetVersion(
    {
      id: TEST_DERIVED_DATASET_VERSION,
      name: "Derived test",
      parent_version_id: "v0-stub"
    },
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
