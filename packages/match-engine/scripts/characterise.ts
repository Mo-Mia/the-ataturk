import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CALIBRATION_TARGETS,
  simulateMatch,
  type MatchConfig,
  type PlayerInput,
  type Team
} from "../src";

interface SeedResult {
  seed: number;
  score: string;
  goals: number;
  shots: number;
  fouls: number;
  cards: number;
  elapsedMs: number;
}

interface CliOptions {
  seeds: number;
  writeSnapshotPath?: string;
}

const options = parseArgs(process.argv.slice(2));
const results: SeedResult[] = [];
let representativeConfig: MatchConfig | null = null;

for (let seed = 1; seed <= options.seeds; seed += 1) {
  const config = createScenario(seed);
  representativeConfig = representativeConfig ?? config;
  const startedAt = performance.now();
  const snapshot = simulateMatch(config);
  const elapsedMs = performance.now() - startedAt;
  const home = snapshot.finalSummary.statistics.home;
  const away = snapshot.finalSummary.statistics.away;

  results.push({
    seed,
    score: `${snapshot.finalSummary.finalScore.home}-${snapshot.finalSummary.finalScore.away}`,
    goals:
      home.goals +
      away.goals -
      (config.preMatchScore?.home ?? 0) -
      (config.preMatchScore?.away ?? 0),
    shots: home.shots.total + away.shots.total,
    fouls: home.fouls + away.fouls,
    cards: home.yellowCards + away.yellowCards + home.redCards + away.redCards,
    elapsedMs
  });
}

if (options.writeSnapshotPath && representativeConfig) {
  const outputPath = resolve(process.cwd(), options.writeSnapshotPath);
  writeFileSync(outputPath, `${JSON.stringify(simulateMatch(representativeConfig), null, 2)}\n`);
}

const report = buildReport(results);
printReport(report, options.seeds);

if (!report.pass) {
  process.exitCode = 1;
}

function createScenario(seed: number): MatchConfig {
  return {
    homeTeam: createTeam("liverpool", "Liverpool", "LIV", "4-4-2", "attacking", "fast", 74),
    awayTeam: createTeam("ac-milan", "AC Milan", "MIL", "4-3-1-2", "balanced", "normal", 77),
    duration: "second_half",
    seed,
    preMatchScore: { home: 0, away: 3 }
  };
}

function createTeam(
  id: string,
  name: string,
  shortName: string,
  formation: string,
  mentality: Team["tactics"]["mentality"],
  tempo: Team["tactics"]["tempo"],
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

  return {
    id,
    name,
    shortName,
    primaryColor: id === "liverpool" ? "#c8102e" : "#ffffff",
    secondaryColor: id === "liverpool" ? "#ffffff" : "#111111",
    players: positions.map((position, index) => player(id, name, position, index, base)),
    tactics: {
      formation,
      mentality,
      tempo,
      pressing: id === "liverpool" ? "high" : "medium",
      lineHeight: id === "liverpool" ? "high" : "normal",
      width: "normal"
    }
  };
}

function player(
  teamId: string,
  teamName: string,
  position: PlayerInput["position"],
  index: number,
  base: number
): PlayerInput {
  const isGoalkeeper = position === "GK";
  const isForward = ["ST", "LW", "RW", "AM"].includes(position);
  const isDefender = ["CB", "LB", "RB", "DM"].includes(position);

  return {
    id: `${teamId}-${index}`,
    name: `${teamName} ${index + 1}`,
    shortName: `${position}${index + 1}`,
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

function buildReport(results: SeedResult[]): {
  averages: Record<"shots" | "goals" | "fouls" | "cards" | "elapsedMs", number>;
  scoreDistribution: Array<{ score: string; count: number; pct: number }>;
  pass: boolean;
} {
  const averages = {
    shots: avg(results.map((result) => result.shots)),
    goals: avg(results.map((result) => result.goals)),
    fouls: avg(results.map((result) => result.fouls)),
    cards: avg(results.map((result) => result.cards)),
    elapsedMs: avg(results.map((result) => result.elapsedMs))
  };
  const counts = new Map<string, number>();
  for (const result of results) {
    counts.set(result.score, (counts.get(result.score) ?? 0) + 1);
  }
  const scoreDistribution = [...counts.entries()]
    .map(([score, count]) => ({ score, count, pct: count / results.length }))
    .sort((a, b) => b.count - a.count);
  const topScoreShare = scoreDistribution[0]?.pct ?? 0;
  const pass =
    inRange(averages.shots, CALIBRATION_TARGETS.shotsTarget) &&
    inRange(averages.goals, CALIBRATION_TARGETS.goalsTarget) &&
    inRange(averages.fouls, CALIBRATION_TARGETS.foulsTarget) &&
    inRange(averages.cards, CALIBRATION_TARGETS.cardsTarget) &&
    topScoreShare <= CALIBRATION_TARGETS.maxSingleScoreShare;

  return { averages, scoreDistribution, pass };
}

function printReport(report: ReturnType<typeof buildReport>, seeds: number): void {
  console.log(`=== Match Engine Characterisation (${seeds} seeds, second half) ===`);
  console.log(
    `Shots: ${report.averages.shots.toFixed(2)} target ${range(CALIBRATION_TARGETS.shotsTarget)}`
  );
  console.log(
    `Goals: ${report.averages.goals.toFixed(2)} target ${range(CALIBRATION_TARGETS.goalsTarget)}`
  );
  console.log(
    `Fouls: ${report.averages.fouls.toFixed(2)} target ${range(CALIBRATION_TARGETS.foulsTarget)}`
  );
  console.log(
    `Cards: ${report.averages.cards.toFixed(2)} target ${range(CALIBRATION_TARGETS.cardsTarget)}`
  );
  console.log(`Average elapsed: ${report.averages.elapsedMs.toFixed(2)}ms`);
  console.log("Score distribution:");
  for (const row of report.scoreDistribution.slice(0, 8)) {
    console.log(`  ${row.score}: ${row.count} (${Math.round(row.pct * 100)}%)`);
  }
  console.log(`Calibration pass: ${report.pass ? "yes" : "no"}`);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { seeds: 50 };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if ((arg === "--seeds" || arg === "-n") && args[index + 1]) {
      options.seeds = Number(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith("--seeds=")) {
      options.seeds = Number(arg.slice("--seeds=".length));
    } else if (arg === "--write-snapshot" && args[index + 1]) {
      const outputPath = args[index + 1];
      if (outputPath) {
        options.writeSnapshotPath = outputPath;
      }
      index += 1;
    }
  }

  if (!Number.isInteger(options.seeds) || options.seeds <= 0) {
    throw new Error("Expected --seeds to be a positive integer");
  }

  return options;
}

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inRange(value: number, rangeValue: [number, number]): boolean {
  return value >= rangeValue[0] && value <= rangeValue[1];
}

function range(value: [number, number]): string {
  return `[${value[0]}, ${value[1]}]`;
}
