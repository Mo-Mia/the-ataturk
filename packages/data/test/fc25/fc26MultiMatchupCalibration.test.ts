import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildDirectionalFixtureMatrix,
  classifyAgainstRealPl,
  importFc25Dataset,
  parseFootballDataBenchmark,
  runFc26MultiMatchupCalibration
} from "../../src";
import { createTestDatabase, type TestDatabase } from "../test-db";

const FC25_FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";
const FC26_PATH = "data/fc-25/FC26_20250921.csv";
const BENCHMARK_CSV = `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HS,AS,HF,AF,HC,AC,HY,AY,HR,AR
E0,15/08/2025,Liverpool,Bournemouth,4,2,19,10,7,10,6,7,1,2,0,0
E0,16/08/2025,Aston Villa,Newcastle,0,0,3,16,13,11,3,6,1,1,1,0
E0,16/08/2025,Brighton,Fulham,1,1,10,7,16,15,4,3,3,3,0,0
`;
const CROSS_CHECK_CSV = `Div,Date,HomeTeam,AwayTeam,FTHG,FTAG,HS,AS,HF,AF,HC,AC,HY,AY,HR,AR
E0,16/08/2024,Man United,Fulham,1,0,14,10,12,10,7,8,2,3,0,0
E0,17/08/2024,Arsenal,Wolves,2,0,18,9,11,14,8,2,1,2,0,0
E0,17/08/2024,Everton,Brighton,0,3,9,15,8,8,1,5,1,1,1,0
`;

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("FC26 multi-matchup calibration helpers", () => {
  it("builds all 20 directional fixtures across the five FC26 clubs", () => {
    const fixtures = buildDirectionalFixtureMatrix();

    expect(fixtures).toHaveLength(20);
    expect(new Set(fixtures.map((fixture) => `${fixture.home}-${fixture.away}`)).size).toBe(20);
    expect(fixtures).toContainEqual({ home: "arsenal", away: "aston-villa" });
    expect(fixtures).toContainEqual({ home: "aston-villa", away: "arsenal" });
    expect(fixtures.every((fixture) => fixture.home !== fixture.away)).toBe(true);
  });

  it("parses Football-Data.co.uk benchmark means and home advantage", () => {
    const benchmark = parseFootballDataBenchmark({
      csv: BENCHMARK_CSV,
      season: "2025-26-to-date",
      sourceUrl: "inline",
      accessedAt: "2026-05-04",
      complete: false
    });

    expect(benchmark.matchCount).toBe(3);
    expect(benchmark.metrics.totalGoals.mean).toBeCloseTo(8 / 3, 6);
    expect(benchmark.metrics.totalShots.mean).toBeCloseTo(65 / 3, 6);
    expect(benchmark.metrics.totalCards.mean).toBeCloseTo(12 / 3, 6);
    expect(benchmark.metrics.corners.mean).toBeCloseTo(29 / 3, 6);
    expect(benchmark.homeAdvantage.goals.mean).toBeCloseTo(2 / 3, 6);
  });

  it("classifies FC26 metrics against current-season and cross-check benchmarks", () => {
    const primary = parseFootballDataBenchmark({
      csv: BENCHMARK_CSV,
      season: "2025-26-to-date",
      sourceUrl: "inline",
      accessedAt: "2026-05-04",
      complete: false
    });
    const crossCheck = parseFootballDataBenchmark({
      csv: CROSS_CHECK_CSV,
      season: "2024-25-complete",
      sourceUrl: "inline",
      accessedAt: "2026-05-04",
      complete: true
    });

    const classifications = classifyAgainstRealPl(
      {
        homeShots: 0,
        awayShots: 0,
        totalShots: primary.metrics.totalShots.mean,
        homeGoals: 0,
        awayGoals: 0,
        totalGoals: primary.metrics.totalGoals.mean + primary.metrics.totalGoals.standardDeviation * 1.5,
        homeFouls: 0,
        awayFouls: 0,
        totalFouls: primary.metrics.totalFouls.mean + primary.metrics.totalFouls.standardDeviation * 3,
        homeCards: 0,
        awayCards: 0,
        totalCards: primary.metrics.totalCards.mean,
        homePossession: 51,
        awayPossession: 49,
        corners: primary.metrics.corners.mean,
        directFreeKicks: 0,
        indirectFreeKicks: 0,
        penalties: 0,
        setPieceGoals: 0,
        penaltyGoals: 0,
        penaltyConversionPct: 0
      },
      primary,
      crossCheck
    );

    expect(classifications.find((row) => row.metric === "totalShots")?.bucket).toBe(1);
    expect(classifications.find((row) => row.metric === "totalGoals")?.bucket).toBe(2);
    expect(classifications.find((row) => row.metric === "totalFouls")?.bucket).toBe(3);
  });

  it("rejects a non-FC26 active runtime dataset", async () => {
    testDatabase = createTestDatabase("fc26-multi-fc25-preflight");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FC25_FIXTURE_PATH,
      datasetVersionId: "fc25-active"
    });

    await expect(
      runFc26MultiMatchupCalibration({
        databasePath: testDatabase.path,
        sanitySeeds: 1,
        seedsPerFixture: 1,
        primaryBenchmarkCsv: BENCHMARK_CSV,
        crossCheckBenchmarkCsv: CROSS_CHECK_CSV,
        outputPath: join(tmpdir(), `fc26-multi-reject-${Date.now()}.json`)
      })
    ).rejects.toThrow(/not the expected FC26 import/);
  });

  it("runs a tiny FC26 multi-matchup report offline", async () => {
    testDatabase = createTestDatabase("fc26-multi-tiny");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FC26_PATH,
      format: "fc26",
      datasetVersionId: "fc26-test-active"
    });

    const report = await runFc26MultiMatchupCalibration({
      databasePath: testDatabase.path,
      sanitySeeds: 1,
      seedsPerFixture: 1,
      primaryBenchmarkCsv: BENCHMARK_CSV,
      crossCheckBenchmarkCsv: CROSS_CHECK_CSV,
      outputPath: join(tmpdir(), `fc26-multi-${Date.now()}.json`),
      gitSha: "test-sha",
      accessedAt: "2026-05-04"
    });

    expect(report.dataset.id).toBe("fc26-test-active");
    expect(report.fixtures).toHaveLength(20);
    expect(report.aggregate.seeds).toBe(20);
    expect(report.realPlBenchmarks.primary.season).toBe("2025-26-to-date");
    expect(report.realPlBenchmarks.gaps.map((gap) => gap.metric)).toContain("possession");
    expect(report.rebasingInventory.docs).toContain("docs/CALIBRATION_REFERENCE.md");
  }, 20_000);
});
