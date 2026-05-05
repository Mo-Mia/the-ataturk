import {
  getActiveFc25DatasetVersion,
  getDb,
  getFc25DatasetVersion,
  importFc25Dataset,
  listFc25DatasetVersions,
  type SquadManagerSuggestion
} from "@the-ataturk/data";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app";
import type { SquadManagerApplyAudit } from "../../src/squad-manager/apply";
import { createServerTestDatabase, type TestDatabase } from "./test-db";

const FC26_PL20_FIXTURE_PATH = "data/fc-25/FC26_20250921.csv";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("Squad Manager low-risk apply admin routes", () => {
  it("creates an inactive audited dataset version for valid low-risk suggestions", async () => {
    testDatabase = createFc26Pl20ServerDatabase("squad-manager-apply-low-risk");
    const db = getDb(testDatabase.path);
    const playerId = firstLiverpoolPlayerId(db);
    const sourceNationality = nationalityFor(db, "fc26-pl20-base", playerId);
    const suggestion = lowRiskSuggestion(playerId, { nationality: "Netherlands" });
    const app = buildApp();

    try {
      const beforeCount = listFc25DatasetVersions(db).length;
      const beforeActive = getActiveFc25DatasetVersion(db)?.id;
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: "fc26-pl20-base",
          riskLevel: "low",
          suggestions: [suggestion]
        }
      });

      expect(response.statusCode).toBe(200);
      const body = response.json<{
        newDatasetVersionId: string;
        activated: boolean;
        idempotent: boolean;
        audit: SquadManagerApplyAudit;
      }>();
      expect(body).toMatchObject({
        activated: false,
        idempotent: false,
        audit: {
          kind: "squad-manager-apply",
          sourceDatasetVersionId: "fc26-pl20-base",
          clubId: "liverpool",
          riskLevel: "low",
          suggestionIds: [suggestion.suggestionId],
          actor: "squad-manager-ui",
          verifyFresh: false
        }
      });
      expect(listFc25DatasetVersions(db)).toHaveLength(beforeCount + 1);
      expect(getActiveFc25DatasetVersion(db)?.id).toBe(beforeActive);
      expect(nationalityFor(db, "fc26-pl20-base", playerId)).toBe(sourceNationality);
      expect(nationalityFor(db, body.newDatasetVersionId, playerId)).toBe("Netherlands");

      const version = getFc25DatasetVersion(body.newDatasetVersionId, db);
      expect(version?.is_active).toBe(false);
      const audit = JSON.parse(version?.description ?? "{}") as SquadManagerApplyAudit;
      expect(audit.payloadHash).toMatch(/^[a-f0-9]{64}$/);
      expect(audit.suggestions).toEqual([suggestion]);
    } finally {
      await app.close();
    }
  }, 15_000);

  it("rejects mixed-risk payloads atomically", async () => {
    testDatabase = createFc26Pl20ServerDatabase("squad-manager-apply-mixed");
    const db = getDb(testDatabase.path);
    const playerId = firstLiverpoolPlayerId(db);
    const app = buildApp();

    try {
      const beforeCount = listFc25DatasetVersions(db).length;
      const response = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: "fc26-pl20-base",
          riskLevel: "low",
          suggestions: [lowRiskSuggestion(playerId, { nationality: "Netherlands", position: "CM" })]
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json<{ error: string }>().error).toContain("non-low-risk changes");
      expect(listFc25DatasetVersions(db)).toHaveLength(beforeCount);
    } finally {
      await app.close();
    }
  }, 15_000);

  it("returns an idempotent existing version for identical repeated applies", async () => {
    testDatabase = createFc26Pl20ServerDatabase("squad-manager-apply-idempotent");
    const db = getDb(testDatabase.path);
    const playerId = firstLiverpoolPlayerId(db);
    const suggestion = lowRiskSuggestion(playerId, { nationality: "Netherlands" });
    const app = buildApp();

    try {
      const first = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: "fc26-pl20-base",
          riskLevel: "low",
          suggestions: [suggestion]
        }
      });
      const countAfterFirst = listFc25DatasetVersions(db).length;
      const firstBody = first.json<{ newDatasetVersionId: string }>();

      const second = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: "fc26-pl20-base",
          riskLevel: "low",
          suggestions: [suggestion]
        }
      });

      expect(second.statusCode).toBe(200);
      expect(second.json()).toMatchObject({
        newDatasetVersionId: firstBody.newDatasetVersionId,
        idempotent: true,
        activated: false
      });
      expect(listFc25DatasetVersions(db)).toHaveLength(countAfterFirst);
    } finally {
      await app.close();
    }
  }, 15_000);

  it("rejects stale source versions and verifyFresh for low risk", async () => {
    testDatabase = createFc26Pl20ServerDatabase("squad-manager-apply-stale");
    const db = getDb(testDatabase.path);
    const playerId = firstLiverpoolPlayerId(db);
    const suggestion = lowRiskSuggestion(playerId, { nationality: "Netherlands" });
    const app = buildApp();

    try {
      const apply = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: "fc26-pl20-base",
          riskLevel: "low",
          suggestions: [suggestion]
        }
      });
      const newDatasetVersionId = apply.json<{ newDatasetVersionId: string }>().newDatasetVersionId;
      const activate = await app.inject({
        method: "POST",
        url: `/api/admin/squad-manager/dataset-versions/${newDatasetVersionId}/activate`
      });
      expect(activate.statusCode).toBe(200);

      const stale = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: "fc26-pl20-base",
          riskLevel: "low",
          suggestions: [lowRiskSuggestion(playerId, { nationality: "Brazil" })]
        }
      });
      expect(stale.statusCode).toBe(400);
      expect(stale.json<{ error: string }>().error).toContain("Stale apply rejected");

      const verifyFresh = await app.inject({
        method: "POST",
        url: "/api/admin/squad-manager/apply",
        payload: {
          clubId: "liverpool",
          datasetVersionId: newDatasetVersionId,
          riskLevel: "low",
          verifyFresh: true,
          suggestions: [lowRiskSuggestion(playerId, { nationality: "Brazil" })]
        }
      });
      expect(verifyFresh.statusCode).toBe(400);
      expect(verifyFresh.json<{ error: string }>().error).toContain("verifyFresh is reserved");
    } finally {
      await app.close();
    }
  }, 15_000);
});

function createFc26Pl20ServerDatabase(prefix: string): TestDatabase {
  const database = createServerTestDatabase(prefix);
  importFc25Dataset({
    databasePath: database.path,
    csvPath: FC26_PL20_FIXTURE_PATH,
    datasetVersionId: "fc26-pl20-base",
    name: "FC26 PL20 base",
    format: "fc26",
    clubUniverse: "pl20",
    now: new Date("2026-05-05T09:00:00.000Z")
  });
  return database;
}

function firstLiverpoolPlayerId(db: ReturnType<typeof getDb>): string {
  return db
    .prepare<
      [],
      { player_id: string }
    >("SELECT player_id FROM fc25_squads WHERE dataset_version_id = 'fc26-pl20-base' AND club_id = 'liverpool' ORDER BY sort_order LIMIT 1")
    .get()!.player_id;
}

function nationalityFor(
  db: ReturnType<typeof getDb>,
  datasetVersionId: string,
  playerId: string
): string {
  return db
    .prepare<
      [string, string],
      { nationality: string }
    >("SELECT nationality FROM fc25_players WHERE dataset_version_id = ? AND id = ?")
    .get(datasetVersionId, playerId)!.nationality;
}

function lowRiskSuggestion(
  playerId: string,
  changes: Extract<SquadManagerSuggestion, { type: "player_update" }>["changes"]
): SquadManagerSuggestion {
  return {
    suggestionId: "sug-low-nationality",
    type: "player_update",
    playerId,
    changes,
    rationale: "Low-risk metadata correction."
  };
}
