import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { simulateMatch, type MatchConfigV2, type TeamTactics, type TeamV2 } from "@the-ataturk/match-engine";

import { getDb, type SqliteDatabase } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25SquadPlayer } from "../types";
import { getActiveFc25DatasetVersion, loadFc25Squad } from "./importer";
import {
  runFc26CalibrationBaseline,
  type Fc26CalibrationBaselineReport
} from "./fc26CalibrationBaseline";
import {
  runFc26Pl20Baseline,
  type Fc26Pl20BaselineReport,
  type Pl20FixtureMetrics
} from "./fc26Pl20Baseline";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/calibration-phase14-validation.json";
const SIDE_SWITCH_HOME: Fc25ClubId = "liverpool";
const SIDE_SWITCH_AWAY: Fc25ClubId = "manchester-city";
const FORMATION: SupportedFormation = "4-3-3";
const TACTICS: TeamTactics = {
  formation: FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

export const PHASE14_REAL_PL_BANDS = {
  totalShots: { mean: 24.8, min: 19.4, max: 30.2 },
  totalGoals: { mean: 2.75, min: 1.16, max: 4.34 },
  totalFouls: { mean: 21.6, min: 16.6, max: 26.6 },
  totalCards: { mean: 3.85, min: 1.83, max: 5.87 },
  corners: { mean: 9.93, min: 6.7, max: 13.2 }
} as const;

export type Phase14Metric = keyof typeof PHASE14_REAL_PL_BANDS;

export interface Phase14ValidationOptions {
  outputPath?: string;
  pl20SeedsPerFixture?: number;
  pl20FixtureLimit?: number;
  responsivenessSeeds?: number;
  manualXiSeeds?: number;
  sideSwitchSeeds?: number;
  sanitySeeds?: number;
  databasePath?: string;
  gitSha?: string;
}

export interface Phase14ValidationReport {
  schemaVersion: 1;
  generatedAt: string;
  gitSha: string;
  pl20: Fc26Pl20BaselineReport;
  classifications: Phase14Classification[];
  responsiveness: {
    rows: Fc26CalibrationBaselineReport["responsiveness"];
    manualXi: Fc26CalibrationBaselineReport["manualXi"];
    pass: boolean;
  };
  sideSwitch: SideSwitchValidation;
  synthesis: {
    eventVolumePass: boolean;
    responsivenessPass: boolean;
    sideSwitchPass: boolean;
    readyToLock: boolean;
  };
}

export interface Phase14Classification {
  metric: Phase14Metric;
  value: number;
  targetMean: number;
  band: [number, number];
  pass: boolean;
}

export interface SideSwitchValidation {
  seeds: number;
  disabled: Pick<Pl20FixtureMetrics, "totalShots" | "totalGoals" | "totalFouls" | "totalCards" | "corners">;
  enabled: Pick<Pl20FixtureMetrics, "totalShots" | "totalGoals" | "totalFouls" | "totalCards" | "corners">;
  deltas: Pick<Pl20FixtureMetrics, "totalShots" | "totalGoals" | "totalFouls" | "totalCards" | "corners">;
  pass: boolean;
  note: string;
}

export function runPhase14CalibrationValidation(
  options: Phase14ValidationOptions = {}
): Phase14ValidationReport {
  const pl20Options = {
    outputPath: "packages/match-engine/artifacts/calibration-phase14-pl20.json",
    seedsPerFixture: options.pl20SeedsPerFixture ?? 50,
    sanitySeeds: options.sanitySeeds ?? 5,
    ...(options.pl20FixtureLimit === undefined ? {} : { fixtureLimit: options.pl20FixtureLimit }),
    ...(options.databasePath === undefined ? {} : { databasePath: options.databasePath }),
    ...(options.gitSha === undefined ? {} : { gitSha: options.gitSha })
  };
  const pl20 = runFc26Pl20Baseline(pl20Options);
  const responsivenessOptions = {
    outputPath: "packages/match-engine/artifacts/calibration-phase14-responsiveness.json",
    characterisationSeeds: 1,
    responsivenessSeeds: options.responsivenessSeeds ?? 200,
    manualXiSeeds: options.manualXiSeeds ?? 1000,
    sanitySeeds: options.sanitySeeds ?? 5,
    ...(options.databasePath === undefined ? {} : { databasePath: options.databasePath }),
    ...(options.gitSha === undefined ? {} : { gitSha: options.gitSha })
  };
  const responsiveness = runFc26CalibrationBaseline(responsivenessOptions);
  const classifications = classifyPhase14Metrics(pl20.aggregate.metrics);
  const responsivenessPass =
    responsiveness.responsiveness.every((row) => row.status !== "FAIL") &&
    responsiveness.manualXi.status === "PASS";
  const sideSwitch = runSideSwitchValidation({
    seeds: options.sideSwitchSeeds ?? 200,
    ...(options.databasePath === undefined ? {} : { databasePath: options.databasePath })
  });
  const eventVolumePass = classifications.every((row) => row.pass);
  const report: Phase14ValidationReport = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitSha: options.gitSha ?? "unknown",
    pl20,
    classifications,
    responsiveness: {
      rows: responsiveness.responsiveness,
      manualXi: responsiveness.manualXi,
      pass: responsivenessPass
    },
    sideSwitch,
    synthesis: {
      eventVolumePass,
      responsivenessPass,
      sideSwitchPass: sideSwitch.pass,
      readyToLock: eventVolumePass && responsivenessPass && sideSwitch.pass
    }
  };

  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function classifyPhase14Metrics(metrics: Pl20FixtureMetrics): Phase14Classification[] {
  return (Object.keys(PHASE14_REAL_PL_BANDS) as Phase14Metric[]).map((metric) => {
    const band = PHASE14_REAL_PL_BANDS[metric];
    const value = metrics[metric];
    return {
      metric,
      value,
      targetMean: band.mean,
      band: [band.min, band.max],
      pass: value >= band.min && value <= band.max
    };
  });
}

function runSideSwitchValidation(options: {
  seeds: number;
  databasePath?: string;
}): SideSwitchValidation {
  const db = getDb(options.databasePath);
  const version = getActiveFc25DatasetVersion(db);
  if (!version) {
    throw new Error("No active FC dataset version is available");
  }
  const home = loadSquad(SIDE_SWITCH_HOME, version.id, db);
  const away = loadSquad(SIDE_SWITCH_AWAY, version.id, db);
  const disabled = runSideSwitchSeeds(options.seeds, home, away, false);
  const enabled = runSideSwitchSeeds(options.seeds, home, away, true);
  const deltas = metricDeltas(enabled, disabled);
  return {
    seeds: options.seeds,
    disabled,
    enabled,
    deltas,
    pass: Math.abs(deltas.totalGoals) <= 0.3 && Math.abs(deltas.totalShots) <= 1.5,
    note: "Spot-check guard only: Phase 7 established side-switch equivalence; Phase 14 must not alter side-switch code."
  };
}

function runSideSwitchSeeds(
  seeds: number,
  home: LoadedSquad,
  away: LoadedSquad,
  sideSwitch: boolean
): SideSwitchValidation["enabled"] {
  const rows = Array.from({ length: seeds }, (_, index) => {
    const snapshot = simulateMatch({
      seed: index + 1,
      duration: "full_90",
      homeTeam: buildTeam(home),
      awayTeam: buildTeam(away),
      dynamics: {
        fatigue: true,
        scoreState: true,
        autoSubs: true,
        chanceCreation: true,
        setPieces: true,
        sideSwitch
      }
    });
    const homeStats = snapshot.finalSummary.statistics.home;
    const awayStats = snapshot.finalSummary.statistics.away;
    const setPieces = snapshot.finalSummary.setPieces;
    return {
      totalShots: homeStats.shots.total + awayStats.shots.total,
      totalGoals: snapshot.finalSummary.finalScore.home + snapshot.finalSummary.finalScore.away,
      totalFouls: homeStats.fouls + awayStats.fouls,
      totalCards:
        homeStats.yellowCards + awayStats.yellowCards + homeStats.redCards + awayStats.redCards,
      corners: (setPieces?.home.corners ?? 0) + (setPieces?.away.corners ?? 0)
    };
  });
  return {
    totalShots: average(rows.map((row) => row.totalShots)),
    totalGoals: average(rows.map((row) => row.totalGoals)),
    totalFouls: average(rows.map((row) => row.totalFouls)),
    totalCards: average(rows.map((row) => row.totalCards)),
    corners: average(rows.map((row) => row.corners))
  };
}

interface LoadedSquad {
  clubId: Fc25ClubId;
  clubName: string;
  shortName: string;
  players: Fc25SquadPlayer[];
}

function loadSquad(clubId: Fc25ClubId, versionId: string, db: SqliteDatabase): LoadedSquad {
  return { ...loadFc25Squad(clubId, versionId, { include: "all", db }), clubId };
}

function buildTeam(squad: LoadedSquad): TeamV2 {
  const lineup = selectLineup(squad.players, FORMATION);
  return {
    id: squad.clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: lineup.xi,
    bench: lineup.bench,
    tactics: TACTICS
  };
}

function metricDeltas(
  enabled: SideSwitchValidation["enabled"],
  disabled: SideSwitchValidation["enabled"]
): SideSwitchValidation["deltas"] {
  return {
    totalShots: enabled.totalShots - disabled.totalShots,
    totalGoals: enabled.totalGoals - disabled.totalGoals,
    totalFouls: enabled.totalFouls - disabled.totalFouls,
    totalCards: enabled.totalCards - disabled.totalCards,
    corners: enabled.corners - disabled.corners
  };
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
