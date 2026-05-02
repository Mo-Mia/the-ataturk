import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CALIBRATION_TARGETS,
  simulateMatch,
  type MatchConfig,
  type MatchConfigV2,
  type PlayerInput,
  type PlayerInputV2,
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
  schema: "v1" | "v2";
  preferredFootMode: "either" | "rated";
  duration: MatchConfig["duration"];
  writeSnapshotPath?: string;
}

interface TargetRanges {
  shotsTarget: [number, number];
  goalsTarget: [number, number];
  foulsTarget: [number, number];
  cardsTarget: [number, number];
  maxSingleScoreShare: number;
}

const options = parseArgs(process.argv.slice(2));
const targets = targetsForDuration(options.duration);
const results: SeedResult[] = [];
let representativeConfig: MatchConfig | MatchConfigV2 | null = null;

for (let seed = 1; seed <= options.seeds; seed += 1) {
  const config = createScenario(seed, options.schema, options.preferredFootMode, options.duration);
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

const report = buildReport(results, targets);
printReport(report, options, targets);

if (!report.pass) {
  process.exitCode = 1;
}

function createScenario(
  seed: number,
  schema: CliOptions["schema"],
  preferredFootMode: CliOptions["preferredFootMode"],
  duration: CliOptions["duration"]
): MatchConfig | MatchConfigV2 {
  const homeTeam = createTeam("liverpool", "Liverpool", "LIV", "4-4-2", "attacking", "fast", 74);
  const awayTeam = createTeam("ac-milan", "AC Milan", "MIL", "4-3-1-2", "balanced", "normal", 77);
  const preMatchScore = duration === "second_half" ? { home: 0, away: 3 } : undefined;

  if (schema === "v2") {
    return {
      homeTeam: toV2Team(homeTeam, preferredFootMode),
      awayTeam: toV2Team(awayTeam, preferredFootMode),
      duration,
      seed,
      ...(preMatchScore ? { preMatchScore } : {})
    };
  }

  return {
    homeTeam,
    awayTeam,
    duration,
    seed,
    ...(preMatchScore ? { preMatchScore } : {})
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

function toV2Team(
  team: Team,
  preferredFootMode: CliOptions["preferredFootMode"]
): MatchConfigV2["homeTeam"] {
  return {
    ...team,
    players: team.players.map((teamPlayer, index) =>
      playerV2FromV1(teamPlayer, index, preferredFootMode)
    )
  };
}

function playerV2FromV1(
  playerInput: PlayerInput,
  index: number,
  preferredFootMode: CliOptions["preferredFootMode"]
): PlayerInputV2 {
  const attributes = playerInput.attributes;
  const isGoalkeeper = playerInput.position === "GK";
  const preferredFoot =
    preferredFootMode === "either" ? "either" : index % 4 === 0 ? "left" : "right";
  const weakFootRating =
    preferredFootMode === "either"
      ? 5
      : (Math.min(5, Math.max(2, 2 + (index % 4))) as 2 | 3 | 4 | 5);
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
    skillMovesRating: isGoalkeeper
      ? 1
      : (Math.min(5, Math.max(2, 2 + (index % 4))) as 2 | 3 | 4 | 5),
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

function buildReport(
  results: SeedResult[],
  targetRanges: TargetRanges
): {
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
    inRange(averages.shots, targetRanges.shotsTarget) &&
    inRange(averages.goals, targetRanges.goalsTarget) &&
    inRange(averages.fouls, targetRanges.foulsTarget) &&
    inRange(averages.cards, targetRanges.cardsTarget) &&
    topScoreShare <= targetRanges.maxSingleScoreShare;

  return { averages, scoreDistribution, pass };
}

function printReport(
  report: ReturnType<typeof buildReport>,
  cliOptions: CliOptions,
  targetRanges: TargetRanges
): void {
  console.log(
    `=== Match Engine Characterisation (${cliOptions.seeds} seeds, ${durationLabel(
      cliOptions.duration
    )}, ${cliOptions.schema}, preferred-foot ${cliOptions.preferredFootMode}) ===`
  );
  console.log(
    `Shots: ${report.averages.shots.toFixed(2)} target ${range(targetRanges.shotsTarget)}`
  );
  console.log(
    `Goals: ${report.averages.goals.toFixed(2)} target ${range(targetRanges.goalsTarget)}`
  );
  console.log(
    `Fouls: ${report.averages.fouls.toFixed(2)} target ${range(targetRanges.foulsTarget)}`
  );
  console.log(
    `Cards: ${report.averages.cards.toFixed(2)} target ${range(targetRanges.cardsTarget)}`
  );
  console.log(`Average elapsed: ${report.averages.elapsedMs.toFixed(2)}ms`);
  console.log("Score distribution:");
  for (const row of report.scoreDistribution.slice(0, 8)) {
    console.log(`  ${row.score}: ${row.count} (${Math.round(row.pct * 100)}%)`);
  }
  console.log(`Calibration pass: ${report.pass ? "yes" : "no"}`);
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    seeds: 50,
    schema: "v1",
    preferredFootMode: "rated",
    duration: "second_half"
  };

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
    } else if (arg === "--schema" && args[index + 1]) {
      options.schema = parseSchema(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith("--schema=")) {
      options.schema = parseSchema(arg.slice("--schema=".length));
    } else if (arg === "--preferred-foot-mode" && args[index + 1]) {
      options.preferredFootMode = parsePreferredFootMode(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith("--preferred-foot-mode=")) {
      options.preferredFootMode = parsePreferredFootMode(
        arg.slice("--preferred-foot-mode=".length)
      );
    } else if (arg === "--duration" && args[index + 1]) {
      options.duration = parseDuration(args[index + 1]);
      index += 1;
    } else if (arg?.startsWith("--duration=")) {
      options.duration = parseDuration(arg.slice("--duration=".length));
    }
  }

  if (!Number.isInteger(options.seeds) || options.seeds <= 0) {
    throw new Error("Expected --seeds to be a positive integer");
  }

  return options;
}

function parseSchema(value: string | undefined): CliOptions["schema"] {
  if (value === "v1" || value === "v2") {
    return value;
  }
  throw new Error("Expected --schema to be v1 or v2");
}

function parsePreferredFootMode(value: string | undefined): CliOptions["preferredFootMode"] {
  if (value === "either" || value === "rated") {
    return value;
  }
  throw new Error("Expected --preferred-foot-mode to be either or rated");
}

function parseDuration(value: string | undefined): CliOptions["duration"] {
  if (value === "second_half" || value === "full_90") {
    return value;
  }
  throw new Error("Expected --duration to be second_half or full_90");
}

function targetsForDuration(duration: CliOptions["duration"]): TargetRanges {
  if (duration === "second_half") {
    return CALIBRATION_TARGETS;
  }

  return {
    shotsTarget: doubleRange(CALIBRATION_TARGETS.shotsTarget),
    goalsTarget: doubleRange(CALIBRATION_TARGETS.goalsTarget),
    foulsTarget: doubleRange(CALIBRATION_TARGETS.foulsTarget),
    cardsTarget: doubleRange(CALIBRATION_TARGETS.cardsTarget),
    maxSingleScoreShare: CALIBRATION_TARGETS.maxSingleScoreShare
  };
}

function doubleRange(value: [number, number]): [number, number] {
  return [value[0] * 2, value[1] * 2];
}

function durationLabel(duration: CliOptions["duration"]): string {
  return duration === "second_half" ? "second half" : "full 90";
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
