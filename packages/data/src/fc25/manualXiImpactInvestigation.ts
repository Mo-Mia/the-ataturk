import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  simulateMatch,
  type MatchConfigV2,
  type MatchDynamicsConfig,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";

import { getDb } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25SquadPlayer } from "../types";
import { FC25_SOURCE_FILE_DEFAULT } from "./constants";
import { importFc25Dataset, loadFc25Squad } from "./importer";
import { rotatedLiverpoolXi } from "./realSquadResponsiveness";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

export type InvestigationMode = "strand-a" | "decompose" | "all";
export type InvestigationOutcome =
  | "sample_noise"
  | "real_decay"
  | "borderline"
  | "wide_uncertainty"
  | "dramatic_difference";

interface Options {
  csvPath?: string;
  seeds?: number;
  outputPath?: string;
  mode?: InvestigationMode;
}

export interface GoalImpactSummary {
  seeds: number;
  autoGoalsAverage: number;
  rotatedGoalsAverage: number;
  pairedGoalDeltaAverage: number;
  pairedGoalDeltaStandardError: number;
  impactPct: number;
  impactMagnitudePct: number;
  impactStandardErrorPct: number;
  confidenceInterval95Pct: [number, number];
}

export interface DecompositionRow extends GoalImpactSummary {
  key: string;
  label: string;
  dynamics: MatchDynamicsConfig;
  restorationFromAllOnPct?: number;
}

export interface ManualXiImpactInvestigationReport {
  generatedAt: string;
  csvPath: string;
  matchup: { home: Fc25ClubId; away: Fc25ClubId };
  rotation: {
    description: string;
    removedStarterIds: string[];
    addedBenchIds: string[];
  };
  strandA: GoalImpactSummary & { outcome: InvestigationOutcome; interpretation: string };
  decomposition?: DecompositionRow[];
  classification: ManualXiImpactClassification;
}

export interface ManualXiImpactClassification {
  outcome: "Outcome 1" | "Outcome 2" | "Outcome 3" | "Needs Mo call";
  rationale: string;
  phase8Readiness: string;
}

const DEFAULT_SEEDS = 1000;
const DEFAULT_OUTPUT_PATH = "packages/match-engine/artifacts/manual-xi-impact-phase9.json";
const BASELINE_FORMATION: SupportedFormation = "4-3-3";
const BASELINE_TACTICS: TeamTactics = {
  formation: BASELINE_FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};

const ALL_ON_DYNAMICS: MatchDynamicsConfig = {
  fatigue: true,
  scoreState: true,
  autoSubs: false,
  chanceCreation: true,
  setPieces: true,
  sideSwitch: true
};

export function runManualXiImpactInvestigation(
  options: Options = {}
): ManualXiImpactInvestigationReport {
  const seeds = options.seeds ?? DEFAULT_SEEDS;
  const mode = options.mode ?? "all";
  const csvPath = resolveRepoPath(options.csvPath ?? FC25_SOURCE_FILE_DEFAULT);
  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const tempDir = mkdtempSync(join(tmpdir(), "footsim-manual-xi-"));
  const databasePath = join(tempDir, "fc25.sqlite");

  try {
    const context = buildContext(csvPath, databasePath);
    const strandA = {
      ...runImpactRow(context, seeds, ALL_ON_DYNAMICS),
      outcome: "sample_noise" as InvestigationOutcome,
      interpretation: ""
    };
    const interpreted = interpretStrandA(strandA);
    strandA.outcome = interpreted.outcome;
    strandA.interpretation = interpreted.interpretation;

    const shouldDecompose =
      mode === "decompose" ||
      (mode === "all" && (strandA.outcome === "real_decay" || strandA.outcome === "borderline"));

    const decomposition = shouldDecompose ? runDecomposition(context, mode === "decompose" ? 500 : 500) : undefined;
    const report: ManualXiImpactInvestigationReport = {
      generatedAt: new Date().toISOString(),
      csvPath,
      matchup: { home: "liverpool", away: "manchester-city" },
      rotation: {
        description:
          "Liverpool 4-3-3 auto XI with the top three highest-overall outfield starters replaced by the top three highest-overall outfield bench players.",
        removedStarterIds: context.rotation.removedStarterIds,
        addedBenchIds: context.rotation.addedBenchIds
      },
      strandA,
      ...(decomposition ? { decomposition } : {}),
      classification: classifyInvestigation(strandA, decomposition)
    };

    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildContext(csvPath: string, databasePath: string): InvestigationContext {
  const importResult = importFc25Dataset({
    csvPath,
    databasePath,
    datasetVersionId: "fc25-manual-xi-investigation"
  });
  const db = getDb(databasePath);
  const liverpool = loadFc25Squad("liverpool", importResult.datasetVersionId, {
    include: "all",
    db
  });
  const city = loadFc25Squad("manchester-city", importResult.datasetVersionId, {
    include: "all",
    db
  });
  return {
    home: liverpool,
    away: city,
    rotation: rotatedLiverpoolXi(liverpool.players, BASELINE_FORMATION)
  };
}

interface InvestigationContext {
  home: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] };
  away: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] };
  rotation: ReturnType<typeof rotatedLiverpoolXi>;
}

function runDecomposition(context: InvestigationContext, seeds: number): DecompositionRow[] {
  const rows = decompositionConfigs().map((config) => ({
    ...config,
    ...runImpactRow(context, seeds, config.dynamics)
  }));
  const allOn = rows.find((row) => row.key === "all_on")!;
  return rows.map((row) => ({
    ...row,
    restorationFromAllOnPct: row.impactMagnitudePct - allOn.impactMagnitudePct
  }));
}

function runImpactRow(
  context: InvestigationContext,
  seeds: number,
  dynamics: MatchDynamicsConfig
): GoalImpactSummary {
  const pairs = Array.from({ length: seeds }, (_, index) => {
    const seed = index + 1;
    return {
      autoGoals: simulateGoals(context, seed, dynamics),
      rotatedGoals: simulateGoals(context, seed, dynamics, context.rotation.rotatedIds)
    };
  });
  return summariseGoalImpact(pairs);
}

export function summariseGoalImpact(
  pairs: Array<{ autoGoals: number; rotatedGoals: number }>
): GoalImpactSummary {
  const seeds = pairs.length;
  const autoGoalsAverage = average(pairs.map((pair) => pair.autoGoals));
  const rotatedGoalsAverage = average(pairs.map((pair) => pair.rotatedGoals));
  const deltas = pairs.map((pair) => pair.rotatedGoals - pair.autoGoals);
  const pairedGoalDeltaAverage = average(deltas);
  const pairedGoalDeltaStandardError = standardError(deltas);
  const impactPct = percentageChange(rotatedGoalsAverage, autoGoalsAverage);
  const impactMagnitudePct = Math.abs(impactPct);
  const impactStandardErrorPct =
    autoGoalsAverage === 0 ? 0 : (pairedGoalDeltaStandardError / autoGoalsAverage) * 100;
  const margin = 1.96 * impactStandardErrorPct;
  return {
    seeds,
    autoGoalsAverage,
    rotatedGoalsAverage,
    pairedGoalDeltaAverage,
    pairedGoalDeltaStandardError,
    impactPct,
    impactMagnitudePct,
    impactStandardErrorPct,
    confidenceInterval95Pct: [impactPct - margin, impactPct + margin]
  };
}

export function interpretStrandA(summary: GoalImpactSummary): {
  outcome: InvestigationOutcome;
  interpretation: string;
} {
  if (summary.impactStandardErrorPct >= 5) {
    return {
      outcome: "wide_uncertainty",
      interpretation:
        "The 1000-seed paired standard error is wide enough to require Mo's call before locking a classification."
    };
  }
  if (summary.impactMagnitudePct >= 18.09) {
    return {
      outcome: "dramatic_difference",
      interpretation:
        "The 1000-seed result differs from the Phase 8 200-seed result by roughly ten percentage points or more."
    };
  }
  if (summary.impactMagnitudePct >= 13) {
    return {
      outcome: "sample_noise",
      interpretation:
        "Manual XI impact remains materially strong under tighter sampling; the Phase 8 miss was likely sample noise or threshold tightness."
    };
  }
  if (summary.impactMagnitudePct <= 10) {
    return {
      outcome: "real_decay",
      interpretation: "Manual XI impact decay is confirmed under tighter sampling; decompose by mechanic."
    };
  }
  return {
    outcome: "borderline",
    interpretation: "Manual XI impact is borderline; decompose by mechanic before classifying."
  };
}

function classifyInvestigation(
  strandA: GoalImpactSummary & { outcome: InvestigationOutcome },
  decomposition?: DecompositionRow[]
): ManualXiImpactClassification {
  if (strandA.outcome === "wide_uncertainty" || strandA.outcome === "dramatic_difference") {
    return {
      outcome: "Needs Mo call",
      rationale: "Strand A produced an interpretation that should not be auto-classified.",
      phase8Readiness: "Phase 8 remains paused."
    };
  }
  if (strandA.outcome === "sample_noise") {
    return {
      outcome: "Outcome 1",
      rationale: "Tighter sampling restored manual XI impact above the investigation threshold.",
      phase8Readiness: "Phase 8 can resume against current engine state."
    };
  }
  if (!decomposition) {
    return {
      outcome: "Needs Mo call",
      rationale: "Real decay was found, but decomposition was not run.",
      phase8Readiness: "Phase 8 remains paused."
    };
  }
  const allOn = decomposition.find((row) => row.key === "all_on")!;
  const allOff = decomposition.find((row) => row.key === "all_dynamics_off")!;
  const bestSingleOff = decomposition
    .filter((row) => row.key.endsWith("_off") && row.key !== "all_dynamics_off")
    .sort((a, b) => (b.restorationFromAllOnPct ?? 0) - (a.restorationFromAllOnPct ?? 0))[0];

  if (bestSingleOff && (bestSingleOff.restorationFromAllOnPct ?? 0) >= 5) {
    return {
      outcome: "Outcome 3",
      rationale: `${bestSingleOff.label} restores manual XI impact by ${bestSingleOff.restorationFromAllOnPct?.toFixed(
        2
      )}pp from the all-on row, indicating a concentrated absorption path.`,
      phase8Readiness: "Scope a tuning sprint before resuming Phase 8."
    };
  }
  return {
    outcome: "Outcome 2",
    rationale: `Manual XI impact remains lower with current composed mechanics (${allOn.impactPct.toFixed(
      2
    )}%) and is not restored by a single mechanic toggle. The all-off reference is ${allOff.impactPct.toFixed(
      2
    )}%.`,
    phase8Readiness: "Phase 8 can resume against current engine state."
  };
}

function decompositionConfigs(): Array<{ key: string; label: string; dynamics: MatchDynamicsConfig }> {
  return [
    { key: "all_on", label: "All dynamics ON", dynamics: ALL_ON_DYNAMICS },
    {
      key: "chance_creation_off",
      label: "Chance creation OFF",
      dynamics: { ...ALL_ON_DYNAMICS, chanceCreation: false }
    },
    {
      key: "set_pieces_off",
      label: "Set pieces OFF",
      dynamics: { ...ALL_ON_DYNAMICS, setPieces: false }
    },
    {
      key: "fatigue_off",
      label: "Fatigue OFF",
      dynamics: { ...ALL_ON_DYNAMICS, fatigue: false }
    },
    {
      key: "score_state_off",
      label: "Score-state OFF",
      dynamics: { ...ALL_ON_DYNAMICS, scoreState: false }
    },
    {
      key: "side_switch_off",
      label: "Side-switch OFF",
      dynamics: { ...ALL_ON_DYNAMICS, sideSwitch: false }
    },
    {
      key: "all_dynamics_off",
      label: "Phase 4-equivalent dynamics OFF",
      dynamics: {
        fatigue: false,
        scoreState: false,
        autoSubs: false,
        chanceCreation: false,
        setPieces: false,
        sideSwitch: false
      }
    }
  ];
}

function simulateGoals(
  context: InvestigationContext,
  seed: number,
  dynamics: MatchDynamicsConfig,
  startingPlayerIds?: string[]
): number {
  const config: MatchConfigV2 = {
    seed,
    duration: "full_90",
    homeTeam: buildTeam(context.home, BASELINE_TACTICS, startingPlayerIds),
    awayTeam: buildTeam(context.away, BASELINE_TACTICS),
    dynamics
  };
  return simulateMatch(config).finalSummary.finalScore.home;
}

function buildTeam(
  squad: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] },
  tactics: TeamTactics,
  startingPlayerIds?: string[]
): TeamV2 {
  const lineup = selectLineup(squad.players, tactics.formation as SupportedFormation, startingPlayerIds);
  return {
    id: squad.clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: lineup.xi,
    bench: lineup.bench,
    tactics
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardError(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.sqrt(values.length);
}

function percentageChange(variant: number, baseline: number): number {
  if (baseline === 0) {
    return variant === 0 ? 0 : Number.POSITIVE_INFINITY;
  }
  return ((variant - baseline) / baseline) * 100;
}
