import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_FULL_MATCH } from "../src/calibration/constants";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import type { MatchConfigV2, MatchTick, SemanticEvent } from "../src/types";
import { runTick } from "../src/ticks/runTick";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-half-time-v2.json"
);
const config = fullMatchConfig(
  createTestConfigV2(781, { preferredFoot: "right", weakFootRating: 4 })
);
const state = buildInitState(config);
const ticks: MatchTick[] = [];
const forcedCarrierId = "home-8";

for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
  if (state.iteration >= 895 && state.iteration < 900) {
    primeAttackingHalfTimeState(state);
  }

  runTick(state);

  if (count === TICKS_PER_FULL_MATCH - 1) {
    emitFullTime(state);
  }

  ticks.push(toMatchTick(state));
}

assertForcedHalfTime(ticks);

const snapshot = buildSnapshot(state, config, ticks);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced half-time snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function fullMatchConfig(config: MatchConfigV2): MatchConfigV2 {
  const fullConfig: MatchConfigV2 = {
    homeTeam: config.homeTeam,
    awayTeam: config.awayTeam,
    seed: config.seed,
    duration: "full_90"
  };
  if (config.preMatchStats) {
    fullConfig.preMatchStats = config.preMatchStats;
  }
  return fullConfig;
}

function primeAttackingHalfTimeState(state: MutableMatchState): void {
  const carrier = requiredPlayer(state, forcedCarrierId);
  state.pendingGoal = null;
  state.pendingSetPiece = null;
  carrier.position = [110, 760];
  state.players.forEach((player) => {
    player.hasBall = player.id === carrier.id;
  });
  state.ball.carrierPlayerId = carrier.id;
  state.ball.position = [carrier.position[0], carrier.position[1], 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "medium" };
  state.score.home = Math.max(state.score.home, 1);
  state.stats.home.goals = state.score.home;
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function assertForcedHalfTime(ticks: MatchTick[]): void {
  const flattenedEvents = events(ticks);
  const halfTime = flattenedEvents.find((event) => event.type === "half_time");
  const secondHalfKickoff = flattenedEvents.find(
    (event) => event.type === "kick_off" && event.team === "away" && event.detail?.secondHalf
  );
  const fullTime = flattenedEvents.find((event) => event.type === "full_time");

  if (!halfTime) {
    throw new Error("Expected a half-time event");
  }
  if (halfTime.minute !== 45 || halfTime.second !== 0) {
    throw new Error("Expected half-time at 45:00");
  }
  if (!secondHalfKickoff) {
    throw new Error("Expected away second-half kick-off after half-time");
  }
  if (!fullTime) {
    throw new Error("Expected full-time event");
  }
}

function events(ticks: MatchTick[]): SemanticEvent[] {
  return ticks.flatMap((tick) => tick.events);
}
