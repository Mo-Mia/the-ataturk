import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getDb,
  importFc25Dataset,
  loadFc25Squad,
  rotatedLiverpoolXi,
  runRealSquadResponsiveness
} from "../../src";
import { createTestDatabase, type TestDatabase } from "../test-db";

const FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("real-squad responsiveness helpers", () => {
  it("uses a repeatable top-three outfield starter rotation", () => {
    testDatabase = createTestDatabase("real-squad-rotation");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FIXTURE_PATH,
      datasetVersionId: "fc25-real-squad-test"
    });
    const db = getDb(testDatabase.path);
    const squad = loadFc25Squad("liverpool", "fc25-real-squad-test", {
      include: "all",
      db
    }).players;

    const rotation = rotatedLiverpoolXi(squad, "4-3-3");
    const shortNameById = new Map(squad.map((player) => [player.id, player.shortName]));

    expect(rotation.removedStarterIds.map((id) => shortNameById.get(id))).toEqual([
      "Dijk",
      "Salah",
      "Alexander-Arnold"
    ]);
    expect(rotation.addedBenchIds.map((id) => shortNameById.get(id))).toEqual([
      "Chiesa",
      "Gakpo",
      "Núñez"
    ]);
    expect(rotation.rotatedIds).toHaveLength(11);
  });

  it("runs a small deterministic fixture-backed report", () => {
    const report = runRealSquadResponsiveness({
      csvPath: FIXTURE_PATH,
      seeds: 2,
      outputPath: join(tmpdir(), `test-real-squad-responsiveness-${Date.now()}.json`)
    });

    expect(report.seeds).toBe(2);
    expect(report.comparisons).toHaveLength(4);
    expect(report.diagnostics).toHaveLength(1);
    expect(report.phase5.fatigueImpact.name).toBe("Fatigue impact");
    expect(report.phase5.subImpact.name).toBe("Auto Subs impact");
    expect(report.phase5.scoreStateImpact.name).toBe("Score-state impact");
    expect(report.rotation.description).toContain("top three highest-overall outfield starters");
  }, 15_000);
});
