import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { MatchSnapshot } from "../../src";

describe("UAT scenario artefacts", () => {
  it("generates a forced early-goal replay with conceding-team kickoff", () => {
    const outputPath = runScenarioScript("forcedEarlyGoal.ts", "forced-early-goal-v2.json");
    const snapshot = readSnapshot(outputPath);
    const events = snapshot.ticks.flatMap((tick) => tick.events);

    expect(events.some((event) => event.type === "goal_scored" && event.team === "home")).toBe(
      true
    );
    expect(
      events.some(
        (event) => event.type === "kick_off" && event.team === "away" && event.detail?.afterGoal
      )
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "possession_change" &&
          event.team === "away" &&
          event.detail?.cause === "kickoff_after_goal"
      )
    ).toBe(true);
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });

  it("generates a forced high-momentum replay with support beyond halfway", () => {
    const outputPath = runScenarioScript(
      "forcedHighMomentumAttack.ts",
      "forced-high-momentum-attack-v2.json"
    );
    const snapshot = readSnapshot(outputPath);
    const supportTicks = snapshot.ticks.filter(
      (tick) =>
        (tick.attackMomentum?.home ?? 0) >= 65 &&
        (tick.diagnostics?.shape.home.oppositionHalfPlayers ?? 0) >= 3
    );

    expect(supportTicks.length).toBeGreaterThanOrEqual(5);
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });

  it("generates a forced half-time crossing replay with second-half kickoff", () => {
    const outputPath = runScenarioScript("forcedHalfTimeCrossing.ts", "forced-half-time-v2.json");
    const snapshot = readSnapshot(outputPath);
    const events = snapshot.ticks.flatMap((tick) => tick.events);

    expect(snapshot.ticks).toHaveLength(1800);
    expect(events.some((event) => event.type === "half_time" && event.minute === 45)).toBe(true);
    expect(
      events.some(
        (event) => event.type === "kick_off" && event.team === "away" && event.detail?.secondHalf
      )
    ).toBe(true);
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });
});

function runScenarioScript(scriptName: string, fileName: string): string {
  const directory = mkdtempSync(join(tmpdir(), "ataturnk-scenario-"));
  const outputPath = join(directory, fileName);
  execFileSync("pnpm", ["exec", "tsx", resolve(process.cwd(), "scripts", scriptName), outputPath], {
    cwd: process.cwd(),
    stdio: "pipe"
  });
  return outputPath;
}

function readSnapshot(path: string): MatchSnapshot {
  return JSON.parse(readFileSync(path, "utf8")) as MatchSnapshot;
}
