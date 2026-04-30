/**
 * Engine Characterisation Script
 *
 * Runs N second-half matches with different Math.random seeds and reports
 * aggregate statistics. Supports running different team configuration variants.
 *
 * Usage:
 *   pnpm --filter server characterise          # 10 seeds, control variant
 *   pnpm --filter server characterise -- -n 50 # 50 seeds, control variant
 *   pnpm --filter server characterise -- -n 50 --variant=all # 50 seeds, all variants
 *
 * Non-destructive: reads the production database but writes nothing.
 */

import fs from "node:fs";
import { playIteration, type MatchDetails, type TeamStatistics } from "@the-ataturk/engine";
import { withEngineConsoleMuted } from "@the-ataturk/engine/internal/silence";

import { ITERATIONS_PER_HALF } from "../config";
import { buildHalfTimeMatchState } from "./half-time-state";
import { extractEvents, type SemanticEvent, type SemanticEventType } from "./events";
import { clockForIteration } from "./orchestrator";

// ---------------------------------------------------------------------------
// Variants Config
// ---------------------------------------------------------------------------

export type VariantName = "control" | "both-attack" | "milan-attack" | "milan-tackle-boost" | "liverpool-shoot-boost";

interface VariantConfig {
  name: VariantName;
  description: string;
}

const ALL_VARIANTS: VariantConfig[] = [
  { name: "control", description: "current default (Liverpool attack, Milan defend, attrs as-is)" },
  { name: "both-attack", description: "Liverpool and Milan both intent=attack" },
  { name: "milan-attack", description: "Liverpool=defend, Milan=attack (counter-intuitive)" },
  { name: "milan-tackle-boost", description: "Milan defenders' tackling +10 (cap at 100)" },
  { name: "liverpool-shoot-boost", description: "Liverpool forwards' shooting +10 (cap at 100)" }
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SeedResult {
  seed: number;
  homeGoals: number;
  awayGoals: number;
  homeShots: number;
  awayShots: number;
  homeFouls: number;
  awayFouls: number;
  homeYellows: number;
  awayYellows: number;
  homeReds: number;
  awayReds: number;
  semanticEvents: number;
  semanticEventsByType: Record<SemanticEventType, number>;
  shotExtractionGap: number;
  foulExtractionGap: number;
  elapsedMs: number;
  crashed: boolean;
  crashIteration?: number;
  crashError?: string;
}

interface AggregateStat {
  min: number;
  max: number;
  avg: number;
  median: number;
}

interface VariantReport {
  variant: VariantConfig;
  mutationLog: string[];
  crashes: number;
  crashDetails: string[];
  completed: number;
  homeGoalsAgg: AggregateStat;
  awayGoalsAgg: AggregateStat;
  totalGoalsAgg: AggregateStat;
  totalShotsAgg: AggregateStat;
  totalFoulsAgg: AggregateStat;
  totalYellowsAgg: AggregateStat;
  totalRedsAgg: AggregateStat;
  semanticEventsAgg: AggregateStat;
  shotGapAgg: AggregateStat;
  foulGapAgg: AggregateStat;
  elapsedMsAgg: AggregateStat;
  semanticEventsByTypeAgg: Record<SemanticEventType, AggregateStat>;
  scoreDistribution: Array<{ score: string; count: number; pct: string }>;
}

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Run a single match with a given seed & variant
// ---------------------------------------------------------------------------

async function runMatchWithSeed(seed: number, isFirstSeed: boolean, variant: VariantName, mutationLog: string[]): Promise<SeedResult> {
  const rng = createSeededRandom(seed);
  const originalRandom = Math.random;
  Math.random = rng;

  const start = performance.now();

  try {
    const matchDetails = await buildHalfTimeMatchState(
      "liverpool",
      "ac-milan",
      "v2-llm-derived-final"
    );

    // Apply variant overrides
    if (variant === "both-attack") {
      matchDetails.kickOffTeam.intent = "attack";
      matchDetails.secondTeam.intent = "attack";
    } else if (variant === "milan-attack") {
      matchDetails.kickOffTeam.intent = "defend";
      matchDetails.secondTeam.intent = "attack";
    } else if (variant === "milan-tackle-boost") {
      // Milan defenders: indices 1-4
      for (let i = 1; i <= 4; i++) {
        const p = matchDetails.secondTeam.players[i];
        if (p) {
          const oldVal = p.skill.tackling;
          p.skill.tackling = Math.min(100, Math.round(Number(oldVal)) + 10);
          if (isFirstSeed) {
            mutationLog.push(`Milan ${p.name} (idx ${i}) tackling: ${oldVal} -> ${p.skill.tackling}`);
          }
        }
      }
    } else if (variant === "liverpool-shoot-boost") {
      // Liverpool forwards: indices 9-10
      for (let i = 9; i <= 10; i++) {
        const p = matchDetails.kickOffTeam.players[i];
        if (p) {
          const oldVal = p.skill.shooting;
          p.skill.shooting = Math.min(100, Math.round(Number(oldVal)) + 10);
          if (isFirstSeed) {
            mutationLog.push(`Liverpool ${p.name} (idx ${i}) shooting: ${oldVal} -> ${p.skill.shooting}`);
          }
        }
      }
    }

    // Snapshot the initial (half-time) statistics so we can compute second-half deltas
    const initialHomeStats = structuredClone(matchDetails.kickOffTeamStatistics);
    const initialAwayStats = structuredClone(matchDetails.secondTeamStatistics);

    let current = matchDetails;
    const allEvents: SemanticEvent[] = [];

    for (let iteration = 1; iteration <= ITERATIONS_PER_HALF; iteration++) {
      const previous = structuredClone(current);
      try {
        current = await withEngineConsoleMuted(() => playIteration(current));
      } catch (engineError) {
        // Engine crashed mid-match — return partial result
        const elapsed = performance.now() - start;
        return {
          seed,
          homeGoals: 0, awayGoals: 0,
          homeShots: 0, awayShots: 0,
          homeFouls: 0, awayFouls: 0,
          homeYellows: 0, awayYellows: 0,
          homeReds: 0, awayReds: 0,
          semanticEvents: allEvents.length,
          semanticEventsByType: countByType(allEvents),
          shotExtractionGap: 0, foulExtractionGap: 0,
          elapsedMs: elapsed,
          crashed: true,
          crashIteration: iteration,
          crashError: engineError instanceof Error ? engineError.message : String(engineError)
        };
      }
      const clock = clockForIteration(iteration);
      const events = extractEvents(previous, current, clock);
      allEvents.push(...events);
    }

    const elapsed = performance.now() - start;

    const finalHomeStats = current.kickOffTeamStatistics;
    const finalAwayStats = current.secondTeamStatistics;

    // Second-half deltas (subtract first-half stats we injected)
    const homeGoals = numStat(finalHomeStats.goals) - numStat(initialHomeStats.goals);
    const awayGoals = numStat(finalAwayStats.goals) - numStat(initialAwayStats.goals);
    const homeShots = finalHomeStats.shots.total - initialHomeStats.shots.total;
    const awayShots = finalAwayStats.shots.total - initialAwayStats.shots.total;
    const homeFouls = numStat(finalHomeStats.fouls) - numStat(initialHomeStats.fouls);
    const awayFouls = numStat(finalAwayStats.fouls) - numStat(initialAwayStats.fouls);

    // Per-player card deltas
    const homeYellows = sumPlayerStat(current.kickOffTeam.players, (p) => p.stats.cards.yellow)
      - sumPlayerStat(matchDetails.kickOffTeam.players, (p) => p.stats.cards.yellow);
    const awayYellows = sumPlayerStat(current.secondTeam.players, (p) => p.stats.cards.yellow)
      - sumPlayerStat(matchDetails.secondTeam.players, (p) => p.stats.cards.yellow);
    const homeReds = sumPlayerStat(current.kickOffTeam.players, (p) => p.stats.cards.red)
      - sumPlayerStat(matchDetails.kickOffTeam.players, (p) => p.stats.cards.red);
    const awayReds = sumPlayerStat(current.secondTeam.players, (p) => p.stats.cards.red)
      - sumPlayerStat(matchDetails.secondTeam.players, (p) => p.stats.cards.red);

    // Semantic event counts by type
    const byType = countByType(allEvents);

    // Extraction gap: team stats say X happened, semantic events caught Y
    const totalStatShots = homeShots + awayShots;
    const totalSemanticShots = byType.shot ?? 0;
    const totalStatFouls = homeFouls + awayFouls;
    const totalSemanticFouls = byType.foul ?? 0;

    return {
      seed,
      homeGoals,
      awayGoals,
      homeShots,
      awayShots,
      homeFouls,
      awayFouls,
      homeYellows,
      awayYellows,
      homeReds,
      awayReds,
      semanticEvents: allEvents.length,
      semanticEventsByType: byType,
      shotExtractionGap: totalStatShots - totalSemanticShots,
      foulExtractionGap: totalStatFouls - totalSemanticFouls,
      elapsedMs: elapsed,
      crashed: false
    };
  } finally {
    Math.random = originalRandom;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function numStat(value: number | string | { total: number }): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.total;
}

function sumPlayerStat(
  players: MatchDetails["kickOffTeam"]["players"],
  accessor: (p: MatchDetails["kickOffTeam"]["players"][0]) => number
): number {
  return players.reduce((sum, p) => sum + accessor(p), 0);
}

function countByType(events: SemanticEvent[]): Record<SemanticEventType, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] ?? 0) + 1;
  }
  return counts as Record<SemanticEventType, number>;
}

function aggregate(values: number[]): AggregateStat {
  if (values.length === 0) return { min: 0, max: 0, avg: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;

  return {
    min: sorted[0]!,
    max: sorted.at(-1)!,
    avg: Number((sum / sorted.length).toFixed(1)),
    median: Number(median.toFixed(1))
  };
}

function fmtAgg(stat: AggregateStat): string {
  return `min=${stat.min}  max=${stat.max}  avg=${stat.avg}  med=${stat.median}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { seedCount, variantsToRun } = parseConfig();
  const seeds = Array.from({ length: seedCount }, (_, i) => i + 1);

  console.log(`\n🏟️  Engine Characterisation: ${seedCount} seeds x ${variantsToRun.length} variants\n`);

  const allReports: VariantReport[] = [];

  for (const variant of variantsToRun) {
    console.log("=".repeat(72));
    console.log(`Variant: ${variant.name} - ${variant.description}`);
    console.log("=".repeat(72));

    const results: SeedResult[] = [];
    const crashes: SeedResult[] = [];
    const mutationLog: string[] = [];

    for (const seed of seeds) {
      const isFirstSeed = (seed === seeds[0]);
      const result = await runMatchWithSeed(seed, isFirstSeed, variant.name, mutationLog);
      results.push(result);
      if (result.crashed) crashes.push(result);

      // Per-seed one-liner
      if (result.crashed) {
        console.log(`  seed ${String(seed).padStart(3)}  💥 CRASH at iteration ${result.crashIteration}: ${result.crashError}`);
      } else {
        const score = `${result.homeGoals}-${result.awayGoals + 3}`;
        const evts = `events=${result.semanticEvents}`;
        const shots = `shots=${result.homeShots + result.awayShots}`;
        const fouls = `fouls=${result.homeFouls + result.awayFouls}`;
        const time = `${Math.round(result.elapsedMs)}ms`;
        console.log(`  seed ${String(seed).padStart(3)}  ${score.padEnd(5)}  ${evts.padEnd(12)}  ${shots.padEnd(10)}  ${fouls.padEnd(10)}  ${time}`);
      }
    }

    if (mutationLog.length > 0) {
      console.log(`\n  Sanity Check Mutations:\n  ${mutationLog.join("\n  ")}`);
    }

    const completed = results.filter((r) => !r.crashed);

    // Aggregate summary points
    const report: VariantReport = {
      variant,
      mutationLog,
      crashes: crashes.length,
      crashDetails: crashes.map(c => `seed ${c.seed}: iteration ${c.crashIteration} — ${c.crashError}`),
      completed: completed.length,
      homeGoalsAgg: aggregate(completed.map(r => r.homeGoals)),
      awayGoalsAgg: aggregate(completed.map(r => r.awayGoals)),
      totalGoalsAgg: aggregate(completed.map(r => r.homeGoals + r.awayGoals)),
      totalShotsAgg: aggregate(completed.map(r => r.homeShots + r.awayShots)),
      totalFoulsAgg: aggregate(completed.map(r => r.homeFouls + r.awayFouls)),
      totalYellowsAgg: aggregate(completed.map(r => r.homeYellows + r.awayYellows)),
      totalRedsAgg: aggregate(completed.map(r => r.homeReds + r.awayReds)),
      semanticEventsAgg: aggregate(completed.map(r => r.semanticEvents)),
      shotGapAgg: aggregate(completed.map(r => r.shotExtractionGap)),
      foulGapAgg: aggregate(completed.map(r => r.foulExtractionGap)),
      elapsedMsAgg: aggregate(completed.map(r => r.elapsedMs)),
      semanticEventsByTypeAgg: {
        goal: aggregate(completed.map(r => r.semanticEventsByType.goal ?? 0)),
        shot: aggregate(completed.map(r => r.semanticEventsByType.shot ?? 0)),
        save: aggregate(completed.map(r => r.semanticEventsByType.save ?? 0)),
        foul: aggregate(completed.map(r => r.semanticEventsByType.foul ?? 0)),
        yellow: aggregate(completed.map(r => r.semanticEventsByType.yellow ?? 0)),
        red: aggregate(completed.map(r => r.semanticEventsByType.red ?? 0))
      },
      scoreDistribution: []
    };

    const scoreMap = new Map<string, number>();
    for (const r of completed) {
      const fullHome = r.homeGoals;
      const fullAway = r.awayGoals + 3; // add first-half Milan goals
      const key = `${fullHome}-${fullAway}`;
      scoreMap.set(key, (scoreMap.get(key) ?? 0) + 1);
    }
    const sortedScores = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]);
    report.scoreDistribution = sortedScores.map(([s, c]) => ({
      score: s,
      count: c,
      pct: ((c / completed.length) * 100).toFixed(0)
    }));

    allReports.push(report);
    console.log("\n");
  }

  // -----------------------------------------------------------------------
  // Final Output
  // -----------------------------------------------------------------------

  const md = generateMarkdownReport(seedCount, allReports);
  const outPath = "/media/mo/Projects/Active_Dev_Projects/2026-the-ataturk/docs/CHARACTERISATION_VARIANTS.md";
  fs.writeFileSync(outPath, md, "utf8");
  console.log(`📄 Markdown report written to: docs/CHARACTERISATION_VARIANTS.md`);
  console.log("\nDone.\n");
}

function generateMarkdownReport(seedCount: number, allReports: VariantReport[]): string {
  let md = `# Match Engine Characterisation Variants Report\n\n`;
  md += `Ran across ${seedCount} seeds per variant. Evaluated 2nd-half performance starting from a simulated 0-3 half-time score.\n\n`;

  md += `## Variant Summary\n\n`;
  md += `| Variant | Description | Liverpool Goals (Avg) | Milan Goals (Avg) | Total Shots (Avg) | Total Fouls (Avg) | Semantic Events (Avg) | Common Result |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const rep of allReports) {
    const topScore = rep.scoreDistribution[0] ? `${rep.scoreDistribution[0].score} (${rep.scoreDistribution[0].pct}%)` : "N/A";
    md += `| **${rep.variant.name}** | ${rep.variant.description} | ${rep.homeGoalsAgg.avg} | ${rep.awayGoalsAgg.avg} | ${rep.totalShotsAgg.avg} | ${rep.totalFoulsAgg.avg} | ${rep.semanticEventsAgg.avg} | ${topScore} |\n`;
  }

  md += `\n## Assessment\n`;
  md += `> [!NOTE]\n> Compare variants above to see which produces more "watchable" and realistic football.\n\n`;

  md += `## Detailed Breakdown\n\n`;

  for (const rep of allReports) {
    md += `### ${rep.variant.name}\n`;
    md += `${rep.variant.description}\n\n`;

    if (rep.mutationLog && rep.mutationLog.length > 0) {
      md += `**Mutations (Sanity Check):**\n`;
      md += rep.mutationLog.map(log => `- ${log}`).join("\n") + "\n\n";
    }

    if (rep.crashes > 0) {
      md += `> [!WARNING]\n> ${rep.crashes} matches crashed mid-simulation.\n\n`;
    }

    md += `#### Aggregates\n`;
    md += `- Liverpool Goals: ${fmtAgg(rep.homeGoalsAgg)}\n`;
    md += `- Milan Goals: ${fmtAgg(rep.awayGoalsAgg)}\n`;
    md += `- Total Shots: ${fmtAgg(rep.totalShotsAgg)}\n`;
    md += `- Total Fouls: ${fmtAgg(rep.totalFoulsAgg)}\n`;
    md += `- Semantic Events: ${fmtAgg(rep.semanticEventsAgg)}\n`;

    md += `\n#### Final Score Distribution (Top 5)\n`;
    for (const score of rep.scoreDistribution.slice(0, 5)) {
      md += `- ${score.score}: ${score.count}x (${score.pct}%)\n`;
    }
    md += `\n---\n\n`;
  }

  return md;
}

interface RunConfig {
  seedCount: number;
  variantsToRun: VariantConfig[];
}

function parseConfig(): RunConfig {
  const args = process.argv.slice(2);
  let seedCount = 10;
  let variantsNames: string[] = ["control"];

  const nIndex = args.indexOf("-n");
  if (nIndex !== -1 && args[nIndex + 1]) {
    const parsed = Number.parseInt(args[nIndex + 1]!, 10);
    if (!Number.isNaN(parsed) && parsed > 0) seedCount = parsed;
  }

  const variantArg = args.find(a => a.startsWith("--variant="));
  if (variantArg) {
    const val = variantArg.split("=")[1];
    if (val === "all") {
      variantsNames = ALL_VARIANTS.map(v => v.name);
    } else if (val) {
      variantsNames = val.split(",");
    }
  }

  const variantsToRun = ALL_VARIANTS.filter(v => variantsNames.includes(v.name));
  if (variantsToRun.length === 0) {
    console.warn("No matching variants found. Defaulting to control.");
    variantsToRun.push(ALL_VARIANTS[0]!);
  }

  return { seedCount, variantsToRun };
}

main().catch((error) => {
  console.error("Characterisation failed:", error);
  process.exit(1);
});
