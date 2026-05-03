import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  simulateMatch,
  type MatchConfigV2,
  type MatchDynamicsConfig,
  type MatchSnapshot,
  type MatchTick,
  type TeamTactics,
  type TeamV2
} from "@the-ataturk/match-engine";
import { TICKS_PER_FULL_MATCH } from "../../../match-engine/src/calibration/constants";
import { buildSnapshot, emitFullTime, toMatchTick } from "../../../match-engine/src/snapshot";
import { buildInitState } from "../../../match-engine/src/state/initState";
import { recordScoreStateEvent } from "../../../match-engine/src/state/scoreState";
import { runTick } from "../../../match-engine/src/ticks/runTick";

import { getDb } from "../db";
import { resolveRepoPath } from "../paths";
import type { Fc25ClubId, Fc25SquadPlayer } from "../types";
import { FC25_SOURCE_FILE_DEFAULT } from "./constants";
import { importFc25Dataset, loadFc25Squad } from "./importer";
import { selectLineup, type SupportedFormation } from "./selectStartingXI";

interface Options {
  csvPath?: string;
  seeds?: number;
  sanitySeeds?: number;
  outputPath?: string;
}

type MetricKey = "final15HomeShots" | "overallTotalShots";
type ProtocolKey = "exact_isolated" | "forced_deficit";
type InvestigationOutcome = "Outcome 1" | "Outcome 2" | "Outcome 3" | "Needs Mo call";

interface RunMetrics {
  final15HomeShots: number;
  overallTotalShots: number;
  homeShots: number;
  awayShots: number;
  chanceCreatedEvents: number;
  convertedChanceEvents: number;
}

export interface PairedMetricSummary {
  metric: MetricKey;
  offAverage: number;
  onAverage: number;
  pairedDeltaAverage: number;
  pairedDeltaStandardError: number;
  effectPct: number;
  effectStandardErrorPct: number;
  confidenceInterval95Pct: [number, number];
}

export interface MetricClassification extends PairedMetricSummary {
  protocol: ProtocolKey;
  outcome: InvestigationOutcome;
  rationale: string;
  recommendation: string;
}

interface ProtocolResult {
  key: ProtocolKey;
  label: string;
  forcedDeficitAt75?: { home: number; away: number };
  metrics: PairedMetricSummary[];
  diagnostics: {
    off: AggregateDiagnostics;
    on: AggregateDiagnostics;
  };
}

interface AggregateDiagnostics {
  homeShots: number;
  awayShots: number;
  chanceCreatedEvents: number;
  convertedChanceEvents: number;
}

export interface ChanceCreationIsolatedInvestigationReport {
  generatedAt: string;
  csvPath: string;
  seeds: number;
  sanityCheck: {
    seeds: number;
    chanceCreatedEventsWithChanceCreationOff: number;
    pass: boolean;
  };
  matchup: { home: Fc25ClubId; away: Fc25ClubId };
  configuration: {
    homeFormation: SupportedFormation;
    awayFormation: SupportedFormation;
    autoSubs: boolean;
    dynamicsExceptChanceCreation: Omit<MatchDynamicsConfig, "chanceCreation">;
  };
  protocols: ProtocolResult[];
  classifications: MetricClassification[];
  pass: boolean;
}

const DEFAULT_SEEDS = 1000;
const DEFAULT_SANITY_SEEDS = 50;
const DEFAULT_OUTPUT_PATH =
  "packages/match-engine/artifacts/chance-creation-isolated-impact-phase10.json";
const HOME_FORMATION: SupportedFormation = "4-3-3";
const AWAY_FORMATION: SupportedFormation = "4-2-3-1";
const HOME_TACTICS: TeamTactics = {
  formation: HOME_FORMATION,
  mentality: "balanced",
  tempo: "normal",
  pressing: "medium",
  lineHeight: "normal",
  width: "normal"
};
const AWAY_TACTICS: TeamTactics = {
  ...HOME_TACTICS,
  formation: AWAY_FORMATION
};
const BASE_DYNAMICS = {
  fatigue: true,
  scoreState: true,
  autoSubs: false,
  setPieces: true,
  sideSwitch: true
};

export function runChanceCreationIsolatedInvestigation(
  options: Options = {}
): ChanceCreationIsolatedInvestigationReport {
  const seeds = options.seeds ?? DEFAULT_SEEDS;
  const sanitySeeds = options.sanitySeeds ?? DEFAULT_SANITY_SEEDS;
  const csvPath = resolveRepoPath(options.csvPath ?? FC25_SOURCE_FILE_DEFAULT);
  const outputPath = resolveRepoPath(options.outputPath ?? DEFAULT_OUTPUT_PATH);
  const tempDir = mkdtempSync(join(tmpdir(), "footsim-chance-creation-"));
  const databasePath = join(tempDir, "fc25.sqlite");

  try {
    const context = buildContext(csvPath, databasePath);
    const sanityCheck = runSanityCheck(context, sanitySeeds);
    const protocols = sanityCheck.pass ? runProtocols(context, seeds) : [];
    const classifications = protocols.flatMap((protocol) =>
      protocol.metrics.map((metric) => classifyMetric(protocol.key, metric))
    );
    const report: ChanceCreationIsolatedInvestigationReport = {
      generatedAt: new Date().toISOString(),
      csvPath,
      seeds,
      sanityCheck,
      matchup: { home: "liverpool", away: "manchester-city" },
      configuration: {
        homeFormation: HOME_FORMATION,
        awayFormation: AWAY_FORMATION,
        autoSubs: false,
        dynamicsExceptChanceCreation: BASE_DYNAMICS
      },
      protocols,
      classifications,
      pass: sanityCheck.pass
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
    datasetVersionId: "fc25-chance-creation-investigation"
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
  return { home: liverpool, away: city };
}

interface InvestigationContext {
  home: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] };
  away: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] };
}

function runSanityCheck(
  context: InvestigationContext,
  seeds: number
): ChanceCreationIsolatedInvestigationReport["sanityCheck"] {
  const chanceCreatedEventsWithChanceCreationOff = Array.from({ length: seeds }, (_, index) =>
    simulate(context, index + 1, false).chanceCreatedEvents
  ).reduce((sum, value) => sum + value, 0);
  return {
    seeds,
    chanceCreatedEventsWithChanceCreationOff,
    pass: chanceCreatedEventsWithChanceCreationOff === 0
  };
}

function runProtocols(context: InvestigationContext, seeds: number): ProtocolResult[] {
  return [
    runProtocol(context, seeds, {
      key: "exact_isolated",
      label: "Exact isolated final-15 protocol"
    }),
    runProtocol(context, seeds, {
      key: "forced_deficit",
      label: "Forced 0-2 deficit at 75:00 protocol",
      forcedDeficitAt75: { home: 0, away: 2 }
    })
  ];
}

function runProtocol(
  context: InvestigationContext,
  seeds: number,
  protocol: Pick<ProtocolResult, "key" | "label" | "forcedDeficitAt75">
): ProtocolResult {
  const pairs = Array.from({ length: seeds }, (_, index) => {
    const seed = index + 1;
    return {
      off: simulate(context, seed, false, protocol.forcedDeficitAt75),
      on: simulate(context, seed, true, protocol.forcedDeficitAt75)
    };
  });

  return {
    ...protocol,
    metrics: [
      summariseMetric("final15HomeShots", pairs),
      ...(protocol.key === "exact_isolated" ? [summariseMetric("overallTotalShots", pairs)] : [])
    ],
    diagnostics: {
      off: aggregateDiagnostics(pairs.map((pair) => pair.off)),
      on: aggregateDiagnostics(pairs.map((pair) => pair.on))
    }
  };
}

function simulate(
  context: InvestigationContext,
  seed: number,
  chanceCreation: boolean,
  forcedDeficitAt75?: { home: number; away: number }
): RunMetrics {
  const config: MatchConfigV2 = {
    seed,
    duration: "full_90",
    homeTeam: buildTeam(context.home, HOME_TACTICS),
    awayTeam: buildTeam(context.away, AWAY_TACTICS),
    dynamics: { ...BASE_DYNAMICS, chanceCreation }
  };
  const snapshot = forcedDeficitAt75
    ? simulateWithLateDeficit(config, forcedDeficitAt75)
    : simulateMatch(config);
  return metricsFor(snapshot);
}

function simulateWithLateDeficit(
  config: MatchConfigV2,
  scoreAt75: { home: number; away: number }
): MatchSnapshot {
  const state = buildInitState(config);
  const ticks: MatchTick[] = [];
  for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
    runTick(state);
    if (state.matchClock.minute === 75 && state.matchClock.seconds === 0) {
      state.score = { ...scoreAt75 };
      state.stats.home.goals = scoreAt75.home;
      state.stats.away.goals = scoreAt75.away;
      recordScoreStateEvent(state);
    }
    if (count === TICKS_PER_FULL_MATCH - 1) {
      emitFullTime(state);
    }
    ticks.push(toMatchTick(state));
  }
  return buildSnapshot(state, config, ticks);
}

function buildTeam(
  squad: { clubId: Fc25ClubId; clubName: string; shortName: string; players: Fc25SquadPlayer[] },
  tactics: TeamTactics
): TeamV2 {
  const lineup = selectLineup(squad.players, tactics.formation as SupportedFormation);
  return {
    id: squad.clubId,
    name: squad.clubName,
    shortName: squad.shortName,
    players: lineup.xi,
    bench: lineup.bench,
    tactics
  };
}

function metricsFor(snapshot: MatchSnapshot): RunMetrics {
  const events = snapshot.ticks.flatMap((tick) => tick.events);
  const homeShots = snapshot.finalSummary.statistics.home.shots.total;
  const awayShots = snapshot.finalSummary.statistics.away.shots.total;
  return {
    final15HomeShots: events.filter(
      (event) => event.team === "home" && event.type === "shot" && event.minute >= 75
    ).length,
    overallTotalShots: homeShots + awayShots,
    homeShots,
    awayShots,
    chanceCreatedEvents: events.filter((event) => event.type === "chance_created").length,
    convertedChanceEvents: events.filter(
      (event) => event.type === "chance_created" && event.detail?.convertedToShot === true
    ).length
  };
}

export function summariseMetric(
  metric: MetricKey,
  pairs: Array<{ off: RunMetrics; on: RunMetrics }>
): PairedMetricSummary {
  const offAverage = average(pairs.map((pair) => pair.off[metric]));
  const onAverage = average(pairs.map((pair) => pair.on[metric]));
  const deltas = pairs.map((pair) => pair.on[metric] - pair.off[metric]);
  const pairedDeltaAverage = average(deltas);
  const pairedDeltaStandardError = standardError(deltas);
  const effectPct = percentageChange(onAverage, offAverage);
  const effectStandardErrorPct =
    offAverage === 0 ? 0 : (pairedDeltaStandardError / offAverage) * 100;
  const margin = 1.96 * effectStandardErrorPct;
  return {
    metric,
    offAverage,
    onAverage,
    pairedDeltaAverage,
    pairedDeltaStandardError,
    effectPct,
    effectStandardErrorPct,
    confidenceInterval95Pct: [effectPct - margin, effectPct + margin]
  };
}

export function classifyMetric(
  protocol: ProtocolKey,
  summary: PairedMetricSummary
): MetricClassification {
  const overlapsZero =
    summary.confidenceInterval95Pct[0] <= 0 && summary.confidenceInterval95Pct[1] >= 0;
  if (Math.abs(summary.effectPct) < 3) {
    return {
      ...summary,
      protocol,
      outcome: "Outcome 1",
      rationale: overlapsZero
        ? "Effect is below 3% and the 95% interval overlaps zero."
        : "Effect is statistically detectable but below the 3% materiality threshold.",
      recommendation: "Document as low-effect-in-isolation; no tuning."
    };
  }

  if (
    protocol === "exact_isolated" &&
    summary.metric === "final15HomeShots" &&
    !overlapsZero &&
    !intervalContains(summary.confidenceInterval95Pct, 2.05) &&
    !intervalContains(summary.confidenceInterval95Pct, -7.14)
  ) {
    return {
      ...summary,
      protocol,
      outcome: "Outcome 3",
      rationale:
        "Exact final-15 result excludes both prior isolated baselines, so a refactor-impact investigation is warranted.",
      recommendation: "Scope a separate Phase 7 chance-creation refactor-impact investigation."
    };
  }

  if (Math.abs(summary.effectPct) >= 3 && !overlapsZero) {
    return {
      ...summary,
      protocol,
      outcome: "Outcome 2",
      rationale: "Effect is at least 3% and the 95% interval excludes zero.",
      recommendation: "Lock empirical magnitude as the current isolated-toggle baseline."
    };
  }

  return {
    ...summary,
    protocol,
    outcome: "Needs Mo call",
    rationale: "Effect magnitude and interval do not fit the predefined buckets cleanly.",
    recommendation: "Surface the result before updating thresholds or model gaps."
  };
}

function aggregateDiagnostics(metrics: RunMetrics[]): AggregateDiagnostics {
  return {
    homeShots: average(metrics.map((metric) => metric.homeShots)),
    awayShots: average(metrics.map((metric) => metric.awayShots)),
    chanceCreatedEvents: average(metrics.map((metric) => metric.chanceCreatedEvents)),
    convertedChanceEvents: average(metrics.map((metric) => metric.convertedChanceEvents))
  };
}

function intervalContains(interval: [number, number], value: number): boolean {
  return interval[0] <= value && value <= interval[1];
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
