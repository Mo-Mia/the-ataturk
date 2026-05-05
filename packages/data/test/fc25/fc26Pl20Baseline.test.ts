import { describe, expect, it } from "vitest";

import { importFc25Dataset } from "../../src";
import {
  buildPl20DirectionalFixtureMatrix,
  runFc26Pl20Baseline
} from "../../src/fc25/fc26Pl20Baseline";
import { createTestDatabase } from "../test-db";

const FC26_PATH = "data/fc-25/FC26_20250921.csv";

describe("FC26 PL20 baseline", () => {
  it("builds every ordered fixture without self-fixtures", () => {
    const fixtures = buildPl20DirectionalFixtureMatrix(["arsenal", "chelsea", "liverpool"]);

    expect(fixtures).toHaveLength(6);
    expect(fixtures).toContainEqual({ home: "arsenal", away: "chelsea" });
    expect(fixtures).toContainEqual({ home: "chelsea", away: "arsenal" });
    expect(fixtures.some((fixture) => fixture.home === fixture.away)).toBe(false);
  });

  it("runs a tiny PL20 report against an FC26 PL20 test dataset", () => {
    const testDatabase = createTestDatabase("fc26-pl20-baseline");
    try {
      importFc25Dataset({
        databasePath: testDatabase.path,
        csvPath: FC26_PATH,
        format: "fc26",
        clubUniverse: "pl20",
        datasetVersionId: "fc26-pl20-baseline-test"
      });

      const report = runFc26Pl20Baseline({
        databasePath: testDatabase.path,
        fixtureLimit: 2,
        seedsPerFixture: 1,
        sanitySeeds: 1,
        outputPath: `${testDatabase.path}.pl20-baseline.json`,
        gitSha: "test"
      });

      expect(report.dataset.clubCount).toBe(20);
      expect(report.fixtureMatrix).toHaveLength(2);
      expect(report.synthesis.totalRuns).toBe(2);
      expect(report.sanity.pass).toBe(true);
      expect(report.aggregate.metrics.totalShots).toBeGreaterThanOrEqual(0);
      expect(report.aggregate.metrics.saves).toBeGreaterThanOrEqual(0);
      expect(
        report.aggregate.metrics.cornersFromDeflectedShots +
          report.aggregate.metrics.cornersFromDefensiveClearances +
          report.aggregate.metrics.cornersFromSavedWide +
          report.aggregate.metrics.cornersFromBlockedDelivery
      ).toBeCloseTo(report.aggregate.metrics.corners);
      expect(report.aggregate.metrics.wideDeliveryPasses).toBeGreaterThanOrEqual(
        report.aggregate.metrics.failedWideDeliveryPasses
      );
    } finally {
      testDatabase.cleanup();
    }
  });
});
