import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_HALF } from "../src/calibration/constants";
import { performShot } from "../src/resolution/actions/shot";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import type { MatchTick, SemanticEvent } from "../src/types";
import { runTick } from "../src/ticks/runTick";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-early-goal-v2.json"
);
const config = createTestConfigV2(778, { preferredFoot: "either", weakFootRating: 5 });
const state = buildInitState(config);
const ticks: MatchTick[] = [];
const forcedIteration = 60;
const forcedScorerId = "home-9";

for (let count = 0; count < TICKS_PER_HALF; count += 1) {
  runTick(state);

  if (state.iteration === forcedIteration) {
    forceGoal(state);
  }

  if (count === TICKS_PER_HALF - 1) {
    emitFullTime(state);
  }

  ticks.push(toMatchTick(state));
}

assertForcedEarlyGoal(ticks);

const snapshot = buildSnapshot(state, config, ticks);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced early-goal snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function forceGoal(state: MutableMatchState): void {
  const scorer = requiredPlayer(state, forcedScorerId);
  scorer.position = [340, 760];
  state.players.forEach((player) => {
    player.hasBall = player.id === scorer.id;
  });
  scorer.hasBall = true;
  state.ball.carrierPlayerId = scorer.id;
  state.ball.position = [scorer.position[0], scorer.position[1], 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "medium" };

  const originalNext = state.rng.next.bind(state.rng);
  const rolls = [0, 1];
  state.rng.next = () => rolls.shift() ?? 1;
  performShot(state, scorer);
  state.rng.next = originalNext;
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function assertForcedEarlyGoal(ticks: MatchTick[]): void {
  const flattenedEvents = events(ticks);
  const goal = flattenedEvents.find(
    (event) => event.type === "goal_scored" && event.playerId === forcedScorerId
  );
  const kickOff = flattenedEvents.find(
    (event) => event.type === "kick_off" && event.team === "away" && event.detail?.afterGoal
  );
  const restartPossession = flattenedEvents.find(
    (event) =>
      event.type === "possession_change" &&
      event.team === "away" &&
      event.detail?.cause === "kickoff_after_goal"
  );

  if (!goal) {
    throw new Error(`Expected forced goal for ${forcedScorerId}`);
  }
  if (!kickOff) {
    throw new Error("Expected away kick-off after the forced Liverpool goal");
  }
  if (!restartPossession) {
    throw new Error("Expected kickoff_after_goal possession change after forced goal");
  }
}

function events(ticks: MatchTick[]): SemanticEvent[] {
  return ticks.flatMap((tick) => tick.events);
}
