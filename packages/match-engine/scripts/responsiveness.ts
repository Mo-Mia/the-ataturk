import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { TICKS_PER_HALF } from "../src/calibration/constants";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import { runTick } from "../src/ticks/runTick";
import {
  simulateMatch,
  type MatchConfig,
  type MatchConfigV2,
  type MatchSnapshot,
  type MatchTick,
  type PlayerInput,
  type PlayerInputV2,
  type StarRating,
  type Team,
  type TeamTactics,
  type TeamV2
} from "../src";

type ExperimentStatus = "PASS" | "FAIL";
type MetricKey = "homeGoals" | "homeShots" | "homeFouls" | "cards" | "homePossessionStreak";

interface RunMetrics {
  seed: number;
  score: string;
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeFouls: number;
  awayFouls: number;
  cards: number;
  homePossessionStreak: number;
}

interface Comparison {
  name: string;
  metric: MetricKey;
  thresholdPct: number;
  baselineLabel: string;
  variantLabel: string;
  baselineAverage: number;
  variantAverage: number;
  deltaPct: number;
  supportingAverages?: Partial<
    Record<MetricKey, { baselineAverage: number; variantAverage: number; deltaPct: number }>
  >;
  status: ExperimentStatus;
}

interface ShiftedMetric {
  metric: MetricKey;
  baselineAverage: number;
  variantAverage: number;
  deltaPct: number;
}

interface MidMatchSwapResult {
  name: string;
  boostedPlayer: string;
  thresholdPct: number;
  shiftedMetrics: ShiftedMetric[];
  status: ExperimentStatus;
}

interface StressResult {
  name: string;
  seeds: number;
  thresholdPct: number;
  maxSharePct: number;
  status: ExperimentStatus;
  topScores: Array<{ score: string; count: number; pct: number }>;
}

interface ResponsivenessReport {
  generatedAt: string;
  seeds: number;
  comparisons: Comparison[];
  midMatchSwap: MidMatchSwapResult;
  stress: StressResult;
  pass: boolean;
}

const SEEDS_50 = 50;
const STRESS_SEEDS = 100;
const BOOSTED_PLAYER_ID = "home-8";
const BOOSTED_PLAYER_NAME = "Smicer";
const outputPath = resolve(process.cwd(), "artifacts/responsiveness-report.json");

const mentality = compareScenario({
  name: "Mentality",
  metric: "homeShots",
  thresholdPct: 30,
  baselineLabel: "Liverpool defensive",
  variantLabel: "Liverpool attacking",
  baselineConfig: (seed) => scenario(seed, { homeTactics: { mentality: "defensive" } }),
  variantConfig: (seed) => scenario(seed, { homeTactics: { mentality: "attacking" } })
});

const pressing = compareScenario({
  name: "Pressing",
  metric: "homeFouls",
  thresholdPct: 20,
  baselineLabel: "Liverpool low pressing",
  variantLabel: "Liverpool high pressing",
  baselineConfig: (seed) => scenario(seed, { homeTactics: { pressing: "low" } }),
  variantConfig: (seed) => scenario(seed, { homeTactics: { pressing: "high" } })
});

const tempo = compareScenario({
  name: "Tempo",
  metric: "homePossessionStreak",
  thresholdPct: 15,
  baselineLabel: "Liverpool slow tempo",
  variantLabel: "Liverpool fast tempo",
  baselineConfig: (seed) => scenario(seed, { homeTactics: { tempo: "slow" } }),
  variantConfig: (seed) => scenario(seed, { homeTactics: { tempo: "fast" } })
});

const attributeBoost = compareScenario({
  name: "Single-player attribute boost",
  metric: "homeGoals",
  thresholdPct: 25,
  baselineLabel: "Unmodified Liverpool",
  variantLabel: `Liverpool ${BOOSTED_PLAYER_NAME} +15`,
  baselineConfig: (seed) => scenario(seed),
  variantConfig: (seed) => scenario(seed, { boostPlayerId: BOOSTED_PLAYER_ID }),
  supportingMetrics: ["homeGoals", "homeShots", "cards"]
});

const midMatchSwap = compareMidMatchSwap();
const stress = runStressTest();
const comparisons = [mentality, pressing, tempo, attributeBoost];
const pass =
  comparisons.every((comparison) => comparison.status === "PASS") &&
  midMatchSwap.status === "PASS" &&
  stress.status === "PASS";

const report: ResponsivenessReport = {
  generatedAt: new Date().toISOString(),
  seeds: SEEDS_50,
  comparisons,
  midMatchSwap,
  stress,
  pass
};

printReport(report);
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote responsiveness report to ${outputPath}`);

if (!pass) {
  process.exitCode = 1;
}

function compareScenario(options: {
  name: string;
  metric: MetricKey;
  thresholdPct: number;
  baselineLabel: string;
  variantLabel: string;
  baselineConfig: (seed: number) => MatchConfig;
  variantConfig: (seed: number) => MatchConfig;
  supportingMetrics?: MetricKey[];
}): Comparison {
  const baseline = runSeeds(SEEDS_50, options.baselineConfig);
  const variant = runSeeds(SEEDS_50, options.variantConfig);
  const baselineAverage = average(baseline.map((result) => result[options.metric]));
  const variantAverage = average(variant.map((result) => result[options.metric]));
  const deltaPct = percentageChange(variantAverage, baselineAverage);
  const supportingAverages =
    options.supportingMetrics && options.supportingMetrics.length > 0
      ? Object.fromEntries(
          options.supportingMetrics.map((metric) => {
            const supportingBaseline = average(baseline.map((result) => result[metric]));
            const supportingVariant = average(variant.map((result) => result[metric]));
            return [
              metric,
              {
                baselineAverage: supportingBaseline,
                variantAverage: supportingVariant,
                deltaPct: percentageChange(supportingVariant, supportingBaseline)
              }
            ];
          })
        )
      : undefined;

  return {
    name: options.name,
    metric: options.metric,
    thresholdPct: options.thresholdPct,
    baselineLabel: options.baselineLabel,
    variantLabel: options.variantLabel,
    baselineAverage,
    variantAverage,
    deltaPct,
    ...(supportingAverages ? { supportingAverages } : {}),
    status: Math.abs(deltaPct) >= options.thresholdPct ? "PASS" : "FAIL"
  };
}

function compareMidMatchSwap(): MidMatchSwapResult {
  const baseline = Array.from({ length: SEEDS_50 }, (_, index) =>
    post60MetricsForSnapshot(index + 1, simulateMatch(scenario(index + 1)))
  );
  const variant = Array.from({ length: SEEDS_50 }, (_, index) =>
    runScriptedSwap(index + 1, BOOSTED_PLAYER_ID)
  );
  const metricKeys: MetricKey[] = [
    "homeGoals",
    "homeShots",
    "homeFouls",
    "cards",
    "homePossessionStreak"
  ];
  const shiftedMetrics = metricKeys
    .map((metric) => {
      const baselineAverage = average(baseline.map((result) => result[metric]));
      const variantAverage = average(variant.map((result) => result[metric]));
      return {
        metric,
        baselineAverage,
        variantAverage,
        deltaPct: percentageChange(variantAverage, baselineAverage)
      };
    })
    .filter((metric) => Math.abs(metric.deltaPct) >= 10);

  return {
    name: "Test-only 60-minute attribute swap",
    boostedPlayer: BOOSTED_PLAYER_NAME,
    thresholdPct: 10,
    shiftedMetrics,
    status: shiftedMetrics.length >= 2 ? "PASS" : "FAIL"
  };
}

function runStressTest(): StressResult {
  const results = Array.from({ length: STRESS_SEEDS }, (_, index) =>
    metricsForSnapshot(index + 1, simulateMatch(calibrationScenarioV2(index + 1)))
  );
  const scores = new Map<string, number>();
  for (const result of results) {
    scores.set(result.score, (scores.get(result.score) ?? 0) + 1);
  }

  const topScores = [...scores.entries()]
    .map(([score, count]) => ({ score, count, pct: (count / STRESS_SEEDS) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxSharePct = topScores[0]?.pct ?? 0;

  return {
    name: "v2-rated score distribution stress",
    seeds: STRESS_SEEDS,
    thresholdPct: 40,
    maxSharePct,
    status: maxSharePct <= 40 ? "PASS" : "FAIL",
    topScores
  };
}

function runSeeds(seeds: number, configForSeed: (seed: number) => MatchConfig): RunMetrics[] {
  return Array.from({ length: seeds }, (_, index) =>
    metricsForSnapshot(index + 1, simulateMatch(configForSeed(index + 1)))
  );
}

function runScriptedSwap(seed: number, playerId: string): RunMetrics {
  const config = scenario(seed);
  const state = buildInitState(config);
  const ticks: MatchTick[] = [];

  for (let count = 0; count < TICKS_PER_HALF; count += 1) {
    runTick(state);
    if (state.matchClock.minute === 60 && state.matchClock.seconds === 0) {
      __testApplyMidMatchAttributeSwap(state, playerId, 15);
    }
    if (count === TICKS_PER_HALF - 1) {
      emitFullTime(state);
    }
    ticks.push(toMatchTick(state));
  }

  return post60MetricsForSnapshot(seed, buildSnapshot(state, config, ticks));
}

function __testApplyMidMatchAttributeSwap(
  state: MutableMatchState,
  playerId: string,
  boost: number
): void {
  const player = requiredPlayer(state, playerId);
  for (const key of Object.keys(player.baseInput.attributes) as Array<
    keyof PlayerInput["attributes"]
  >) {
    player.baseInput.attributes[key] = Math.min(100, player.baseInput.attributes[key] + boost);
  }
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function metricsForSnapshot(seed: number, snapshot: MatchSnapshot): RunMetrics {
  const home = snapshot.finalSummary.statistics.home;
  const away = snapshot.finalSummary.statistics.away;
  return {
    seed,
    score: `${snapshot.finalSummary.finalScore.home}-${snapshot.finalSummary.finalScore.away}`,
    homeGoals: home.goals,
    awayGoals: away.goals,
    homeShots: home.shots.total,
    awayShots: away.shots.total,
    homeFouls: home.fouls,
    awayFouls: away.fouls,
    cards: home.yellowCards + home.redCards + away.yellowCards + away.redCards,
    homePossessionStreak: averagePossessionStreak(snapshot.ticks, "home")
  };
}

function post60MetricsForSnapshot(seed: number, snapshot: MatchSnapshot): RunMetrics {
  const post60Ticks = snapshot.ticks.filter((tick) => tick.matchClock.minute >= 60);
  const events = post60Ticks.flatMap((tick) => tick.events);
  const homeGoals = events.filter(
    (event) => event.team === "home" && (event.type === "goal_scored" || event.type === "goal")
  ).length;
  const awayGoals = events.filter(
    (event) => event.team === "away" && (event.type === "goal_scored" || event.type === "goal")
  ).length;

  return {
    seed,
    score: `${snapshot.finalSummary.finalScore.home}-${snapshot.finalSummary.finalScore.away}`,
    homeGoals,
    awayGoals,
    homeShots: events.filter((event) => event.team === "home" && event.type === "shot").length,
    awayShots: events.filter((event) => event.team === "away" && event.type === "shot").length,
    homeFouls: events.filter((event) => event.team === "home" && event.type === "foul").length,
    awayFouls: events.filter((event) => event.team === "away" && event.type === "foul").length,
    cards: events.filter((event) => event.type === "yellow" || event.type === "red").length,
    homePossessionStreak: averagePossessionStreak(post60Ticks, "home")
  };
}

function averagePossessionStreak(ticks: MatchTick[], teamId: "home" | "away"): number {
  const streaks: number[] = [];
  let current = 0;

  for (const tick of ticks) {
    if (tick.possession.teamId === teamId) {
      current += 1;
    } else if (current > 0) {
      streaks.push(current);
      current = 0;
    }
  }
  if (current > 0) {
    streaks.push(current);
  }
  return average(streaks);
}

function scenario(
  seed: number,
  options: {
    homeTactics?: Partial<TeamTactics>;
    boostPlayerId?: string;
  } = {}
): MatchConfig {
  const homeTeam = createTeam("home", "Liverpool", "LIV", "4-4-2", 74);
  const awayTeam = createTeam("away", "Milan", "MIL", "4-3-1-2", 77);
  homeTeam.tactics = { ...homeTeam.tactics, ...options.homeTactics };
  awayTeam.tactics = baselineTactics("4-3-1-2");

  if (options.boostPlayerId) {
    boostPlayer(homeTeam, options.boostPlayerId, 15);
  }

  return {
    homeTeam,
    awayTeam,
    duration: "second_half",
    seed,
    preMatchScore: { home: 0, away: 3 }
  };
}

function calibrationScenarioV2(seed: number): MatchConfigV2 {
  return {
    homeTeam: toV2Team(createTeam("home", "Liverpool", "LIV", "4-4-2", 74), {
      mentality: "attacking",
      tempo: "fast",
      pressing: "high",
      lineHeight: "high"
    }),
    awayTeam: toV2Team(createTeam("away", "Milan", "MIL", "4-3-1-2", 77), {
      mentality: "balanced",
      tempo: "normal",
      pressing: "medium",
      lineHeight: "normal"
    }),
    duration: "second_half",
    seed,
    preMatchScore: { home: 0, away: 3 }
  };
}

function createTeam(
  id: "home" | "away",
  name: string,
  shortName: string,
  formation: string,
  base: number
): Team {
  const positions: PlayerInput["position"][] = [
    "GK",
    "RB",
    "CB",
    "CB",
    "LB",
    "RW",
    "CM",
    "CM",
    "LW",
    "ST",
    "ST"
  ];
  const names =
    id === "home"
      ? [
          "Dudek",
          "Finnan",
          "Carragher",
          "Hyypia",
          "Riise",
          "Garcia",
          "Gerrard",
          "Alonso",
          "Smicer",
          "Baros",
          "Cisse"
        ]
      : [
          "Dida",
          "Cafu",
          "Nesta",
          "Stam",
          "Maldini",
          "Gattuso",
          "Pirlo",
          "Seedorf",
          "Kaka",
          "Shevchenko",
          "Crespo"
        ];

  return {
    id,
    name,
    shortName,
    players: positions.map((position, index) => player(id, names[index]!, position, index, base)),
    tactics: baselineTactics(formation)
  };
}

function toV2Team(team: Team, tacticOverrides: Partial<TeamTactics>): TeamV2 {
  return {
    ...team,
    tactics: { ...team.tactics, ...tacticOverrides },
    players: team.players.map(playerV2FromV1)
  };
}

function playerV2FromV1(playerInput: PlayerInput, index: number): PlayerInputV2 {
  const attributes = playerInput.attributes;
  const isGoalkeeper = playerInput.position === "GK";
  const preferredFoot = index % 4 === 0 ? "left" : "right";
  const weakFootRating = Math.min(5, Math.max(2, 2 + (index % 4))) as StarRating;
  const reactionsAndComposure = (3 * attributes.perception - attributes.passing) / 2;
  const ballControlAndDribbling = (3 * attributes.control - reactionsAndComposure) / 2;
  const v2Strength = 2 * attributes.strength - attributes.jumping;

  return {
    id: playerInput.id,
    name: playerInput.name,
    shortName: playerInput.shortName,
    ...(playerInput.squadNumber === undefined ? {} : { squadNumber: playerInput.squadNumber }),
    position: playerInput.position,
    height: isGoalkeeper ? 191 : 181,
    weight: isGoalkeeper ? 84 : 76,
    age: 27 + (index % 6),
    preferredFoot,
    weakFootRating,
    skillMovesRating: isGoalkeeper ? 1 : weakFootRating,
    attributes: {
      acceleration: attributes.agility,
      sprintSpeed: attributes.agility,
      finishing: attributes.shooting,
      shotPower: attributes.shooting,
      longShots: attributes.shooting,
      positioning: attributes.shooting,
      volleys: attributes.shooting,
      penalties: attributes.penaltyTaking,
      vision: attributes.passing,
      crossing: attributes.passing,
      freeKickAccuracy: attributes.penaltyTaking,
      shortPassing: attributes.passing,
      longPassing: attributes.passing,
      curve: attributes.passing,
      dribbling: ballControlAndDribbling,
      agility: attributes.agility,
      balance: attributes.agility,
      reactions: reactionsAndComposure,
      ballControl: ballControlAndDribbling,
      composure: reactionsAndComposure,
      interceptions: attributes.tackling,
      headingAccuracy: attributes.jumping,
      defensiveAwareness: attributes.tackling,
      standingTackle: attributes.tackling,
      slidingTackle: attributes.tackling,
      jumping: attributes.jumping,
      stamina: attributes.agility,
      strength: v2Strength,
      aggression: attributes.strength
    },
    ...(isGoalkeeper
      ? {
          gkAttributes: {
            gkDiving: attributes.saving,
            gkHandling: attributes.saving,
            gkKicking: attributes.passing,
            gkPositioning: attributes.saving,
            gkReflexes: attributes.saving
          }
        }
      : {})
  };
}

function baselineTactics(formation: string): TeamTactics {
  return {
    formation,
    mentality: "balanced",
    tempo: "normal",
    pressing: "medium",
    lineHeight: "normal",
    width: "normal"
  };
}

function player(
  teamId: string,
  shortName: string,
  position: PlayerInput["position"],
  index: number,
  base: number
): PlayerInput {
  const isGoalkeeper = position === "GK";
  const isForward = ["ST", "LW", "RW", "AM"].includes(position);
  const isDefender = ["CB", "LB", "RB", "DM"].includes(position);
  return {
    id: `${teamId}-${index}`,
    name: shortName,
    shortName,
    squadNumber: index + 1,
    position,
    attributes: {
      passing: base + (position === "CM" ? 8 : 0),
      shooting: isGoalkeeper ? 20 : base + (isForward ? 8 : -8),
      tackling: isGoalkeeper ? 35 : base + (isDefender ? 8 : -4),
      saving: isGoalkeeper ? base + 12 : 10,
      agility: base + (isForward ? 6 : 0),
      strength: base + (["CB", "ST"].includes(position) ? 6 : 0),
      penaltyTaking: base,
      perception: base + (["CM", "CB", "GK"].includes(position) ? 8 : 0),
      jumping: base + (["CB", "ST", "GK"].includes(position) ? 7 : 0),
      control: base + (isForward || position === "CM" ? 7 : 0)
    }
  };
}

function boostPlayer(team: Team, playerId: string, boost: number): void {
  const playerInput = team.players.find((candidate) => candidate.id === playerId);
  if (!playerInput) {
    throw new Error(`Expected boosted player ${playerId} to exist`);
  }
  for (const key of Object.keys(playerInput.attributes) as Array<keyof PlayerInput["attributes"]>) {
    playerInput.attributes[key] = Math.min(100, playerInput.attributes[key] + boost);
  }
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentageChange(variant: number, baseline: number): number {
  if (baseline === 0) {
    return variant === 0 ? 0 : 100;
  }
  return ((variant - baseline) / baseline) * 100;
}

function printReport(report: ResponsivenessReport): void {
  console.log("=== Match Engine Responsiveness ===");
  for (const comparison of report.comparisons) {
    console.log(
      `${comparison.name}: ${comparison.deltaPct.toFixed(2)}% ${comparison.metric} shift ` +
        `(${comparison.baselineAverage.toFixed(2)} -> ${comparison.variantAverage.toFixed(2)}), ` +
        `${comparison.status}`
    );
    if (comparison.supportingAverages) {
      for (const [metric, values] of Object.entries(comparison.supportingAverages)) {
        console.log(
          `  ${metric}: ${values.deltaPct.toFixed(2)}% ` +
            `(${values.baselineAverage.toFixed(2)} -> ${values.variantAverage.toFixed(2)})`
        );
      }
    }
  }
  console.log(
    `${report.midMatchSwap.name}: ${report.midMatchSwap.shiftedMetrics.length} metrics shifted >= ` +
      `${report.midMatchSwap.thresholdPct}%, ${report.midMatchSwap.status}`
  );
  for (const metric of report.midMatchSwap.shiftedMetrics) {
    console.log(
      `  ${metric.metric}: ${metric.deltaPct.toFixed(2)}% ` +
        `(${metric.baselineAverage.toFixed(2)} -> ${metric.variantAverage.toFixed(2)})`
    );
  }
  console.log(
    `${report.stress.name}: max share ${report.stress.maxSharePct.toFixed(2)}%, ` +
      `${report.stress.status}`
  );
  for (const score of report.stress.topScores) {
    console.log(
      `  ${score.score}: ${score.count}/${report.stress.seeds} (${score.pct.toFixed(2)}%)`
    );
  }
  console.log(`Responsiveness pass: ${report.pass ? "yes" : "no"}`);
}
