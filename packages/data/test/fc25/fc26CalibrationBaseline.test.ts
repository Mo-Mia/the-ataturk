import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  classifyCharacterisation,
  classifyManualXi,
  classifyResponsiveness,
  importFc25Dataset,
  runFc26CalibrationBaseline,
  type CharacterisationRow,
  type ManualXiRow,
  type ResponsivenessRow
} from "../../src";
import { createTestDatabase, type TestDatabase } from "../test-db";

const FC25_FIXTURE_PATH = "data/fc-25/fixtures/male_players_top5pl.csv";
const FC26_PATH = "data/fc-25/FC26_20250921.csv";

let testDatabase: TestDatabase | undefined;

afterEach(() => {
  testDatabase?.cleanup();
  testDatabase = undefined;
});

describe("FC26 calibration baseline helpers", () => {
  it("rejects a non-FC26 active runtime dataset", () => {
    testDatabase = createTestDatabase("fc26-baseline-fc25-preflight");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FC25_FIXTURE_PATH,
      datasetVersionId: "fc25-active"
    });

    expect(() =>
      runFc26CalibrationBaseline({
        databasePath: testDatabase!.path,
        sanitySeeds: 1,
        characterisationSeeds: 1,
        responsivenessSeeds: 1,
        manualXiSeeds: 2,
        outputPath: join(tmpdir(), `fc26-baseline-reject-${Date.now()}.json`)
      })
    ).toThrow(/not the expected FC26 import/);
  });

  it("runs a tiny FC26 baseline and records deterministic manual XI players", () => {
    testDatabase = createTestDatabase("fc26-baseline-tiny");
    importFc25Dataset({
      databasePath: testDatabase.path,
      csvPath: FC26_PATH,
      format: "fc26",
      datasetVersionId: "fc26-test-active"
    });

    const report = runFc26CalibrationBaseline({
      databasePath: testDatabase.path,
      sanitySeeds: 1,
      characterisationSeeds: 1,
      responsivenessSeeds: 1,
      manualXiSeeds: 2,
      outputPath: join(tmpdir(), `fc26-baseline-${Date.now()}.json`),
      gitSha: "test-sha"
    });

    expect(report.dataset.id).toBe("fc26-test-active");
    expect(report.dataset.squadCounts).toMatchObject({
      liverpool: 28,
      "manchester-city": 26
    });
    expect(report.manualXi.removedPlayers.map((player) => player.id)).toEqual([
      "209331",
      "203376",
      "233731"
    ]);
    expect(report.manualXi.addedPlayers.map((player) => player.id)).toEqual([
      "256630",
      "236772",
      "257289"
    ]);
    expect(report.classifications.length).toBeGreaterThan(10);
  }, 20_000);

  it("classifies characterisation buckets from target bands and FC26 standard error", () => {
    const rows: CharacterisationRow[] = [
      {
        id: "second_half_fc26_test",
        duration: "second_half",
        seeds: 200,
        matchup: { home: "liverpool", away: "manchester-city" },
        metrics: { shots: 10.5, goals: 1.65, fouls: 9, cards: 4 },
        standardErrors: { shots: 0.2, goals: 0.2, fouls: 0.2, cards: 0.2 },
        targets: {
          shots: [8, 12],
          goals: [1, 3],
          fouls: [4, 8],
          cards: [1, 3]
        },
        setPieces: {
          corners: 0,
          directFreeKicks: 0,
          indirectFreeKicks: 0,
          penalties: 0,
          setPieceGoals: 0,
          penaltyGoals: 0,
          penaltyConversionPct: 0
        },
        scoreDistribution: [],
        pass: false
      }
    ];

    const classifications = classifyCharacterisation(rows);

    expect(classifications.find((row) => row.metric === "second_half shots")?.bucket).toBe(1);
    expect(classifications.find((row) => row.metric === "second_half goals")?.bucket).toBe(1);
    expect(classifications.find((row) => row.metric === "second_half fouls")?.bucket).toBe(3);
    expect(classifications.find((row) => row.metric === "second_half cards")?.bucket).toBe(3);
  });

  it("classifies responsiveness and manual XI failures as Bucket 3", () => {
    const responsiveness: ResponsivenessRow[] = [
      {
        name: "Mentality",
        metric: "homeShots",
        seeds: 200,
        baselineLabel: "defensive",
        variantLabel: "attacking",
        baselineAverage: 4,
        variantAverage: 4.5,
        deltaPct: 12.5,
        standardErrorPct: 2,
        thresholdPct: 30,
        status: "FAIL",
        phase8DeltaPct: 131
      },
      {
        name: "Formation",
        metric: "homeWideDeliveries",
        seeds: 200,
        baselineLabel: "4-4-2",
        variantLabel: "4-3-3",
        baselineAverage: 1,
        variantAverage: 2,
        deltaPct: 100,
        standardErrorPct: 4,
        thresholdPct: null,
        status: "DIAGNOSTIC",
        phase8DeltaPct: null
      }
    ];
    const manualXi: ManualXiRow = {
      name: "Manual XI rotation",
      seeds: 1000,
      baselineAverage: 1,
      variantAverage: 0.95,
      pairedGoalDeltaAverage: -0.05,
      pairedGoalDeltaStandardError: 0.01,
      deltaPct: -5,
      standardErrorPct: 1,
      confidenceInterval95Pct: [-6.96, -3.04],
      removedPlayers: [],
      addedPlayers: [],
      thresholdPct: 7,
      status: "FAIL",
      phase8DeltaPct: -15.93
    };

    expect(classifyResponsiveness(responsiveness).map((row) => row.bucket)).toEqual([3, 2]);
    expect(classifyManualXi(manualXi).bucket).toBe(3);
  });
});
