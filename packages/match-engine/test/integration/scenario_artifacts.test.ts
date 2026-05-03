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

  it("generates a forced substitution replay", () => {
    const outputPath = runScenarioScript("forcedSubstitution.ts", "forced-substitution-v2.json");
    const snapshot = readSnapshot(outputPath);
    const events = snapshot.ticks.flatMap((tick) => tick.events);
    const finalTick = snapshot.ticks.at(-1);

    expect(events.some((event) => event.type === "substitution" && event.team === "home")).toBe(
      true
    );
    expect(finalTick?.players.find((player) => player.id === "home-5")?.onPitch).toBe(false);
    expect(finalTick?.players.find((player) => player.id === "home-sub-5")?.onPitch).toBe(true);
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });

  it("generates a forced fatigue-impact replay", () => {
    const outputPath = runScenarioScript("forcedFatigueImpact.ts", "forced-fatigue-impact-v2.json");
    const snapshot = readSnapshot(outputPath);
    const homeStamina = snapshot.finalSummary.endStamina?.home ?? [];

    expect(homeStamina.some((player) => player.playerId !== "home-0" && player.stamina < 45)).toBe(
      true
    );
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });

  it("generates a forced late-comeback replay", () => {
    const outputPath = runScenarioScript("forcedLateComeback.ts", "forced-late-comeback-v2.json");
    const snapshot = readSnapshot(outputPath);

    expect(snapshot.finalSummary.scoreStateEvents?.some((event) => event.urgency.home > 1.2)).toBe(
      true
    );
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });

  it("generates a forced chance-creation replay", () => {
    const outputPath = runScenarioScript(
      "forcedChanceCreation.ts",
      "forced-chance-creation-v2.json"
    );
    const snapshot = readSnapshot(outputPath);
    const events = snapshot.ticks.flatMap((tick) => tick.events);

    expect(events.some((event) => event.type === "chance_created" && event.team === "home")).toBe(
      true
    );
    expect(
      events.some(
        (event) =>
          event.type === "shot" &&
          event.team === "home" &&
          typeof event.detail?.chanceSource === "string"
      )
    ).toBe(true);
    expect(existsSync(`${outputPath}.gz`)).toBe(true);
  });

  it("generates a forced set-piece replay", () => {
    const outputPath = runScenarioScript(
      "forcedSetPieceConversion.ts",
      "forced-set-piece-conversion-v2.json"
    );
    const snapshot = readSnapshot(outputPath);
    const events = snapshot.ticks.flatMap((tick) => tick.events);

    expect(events.some((event) => event.type === "corner_taken" && event.team === "home")).toBe(
      true
    );
    expect(events.some((event) => event.type === "penalty_taken" && event.team === "home")).toBe(
      true
    );
    expect(snapshot.finalSummary.setPieces?.home.setPieceShots).toBeGreaterThanOrEqual(2);
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
