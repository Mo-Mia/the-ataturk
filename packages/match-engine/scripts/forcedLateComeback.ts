import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_FULL_MATCH } from "../src/calibration/constants";
import { performShot } from "../src/resolution/actions/shot";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import { recordScoreStateEvent } from "../src/state/scoreState";
import { runTick } from "../src/ticks/runTick";
import type { MatchTick } from "../src/types";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-late-comeback-v2.json"
);
const config = {
  ...createTestConfigV2(784, { preferredFoot: "right", weakFootRating: 4 }),
  duration: "full_90",
  dynamics: { fatigue: true, scoreState: true, autoSubs: true }
} as const;
const state = buildInitState(config);
const ticks: MatchTick[] = [];

for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
  runTick(state);
  if (state.matchClock.minute === 75 && state.matchClock.seconds === 0) {
    state.score = { home: 0, away: 2 };
    state.stats.home.goals = 0;
    state.stats.away.goals = 2;
    recordScoreStateEvent(state);
  }
  if (state.matchClock.minute === 76 && state.matchClock.seconds === 0) {
    forceLiverpoolShot(state);
  }
  if (count === TICKS_PER_FULL_MATCH - 1) {
    emitFullTime(state);
  }
  ticks.push(toMatchTick(state));
}

function forceLiverpoolShot(state: MutableMatchState): void {
  const shooter = requiredPlayer(state, "home-9");
  shooter.position = [340, 790];
  state.players.forEach((player) => {
    player.hasBall = player.id === shooter.id;
  });
  shooter.hasBall = true;
  state.ball.carrierPlayerId = shooter.id;
  state.ball.position = [shooter.position[0], shooter.position[1], 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "medium" };
  performShot(state, shooter);
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

const snapshot = buildSnapshot(state, config, ticks);

assertLatePressure();
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced late-comeback snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function assertLatePressure(): void {
  const homeFinal15Shots = snapshot.ticks
    .flatMap((tick) => tick.events)
    .filter((event) => event.type === "shot" && event.team === "home" && event.minute >= 75).length;
  const urgencyEvents = snapshot.finalSummary.scoreStateEvents ?? [];
  if (!urgencyEvents.some((event) => event.urgency.home > 1.2)) {
    throw new Error("Expected elevated home urgency in forced late-comeback scenario");
  }
  if (homeFinal15Shots < 1) {
    throw new Error("Expected at least one Liverpool shot in the final 15 minutes");
  }
}
