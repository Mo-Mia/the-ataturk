import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_HALF } from "../src/calibration/constants";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import type { MatchTick } from "../src/types";
import { runTick } from "../src/ticks/runTick";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ??
    "artifacts/forced-high-momentum-attack-v2.json"
);
const config = createTestConfigV2(779, { preferredFoot: "left", weakFootRating: 3 });
const state = buildInitState(config);
const ticks: MatchTick[] = [];
const firstMomentumIteration = 180;
const lastMomentumIteration = 230;
const forcedCarrierId = "home-5";

for (let count = 0; count < TICKS_PER_HALF; count += 1) {
  if (state.iteration >= firstMomentumIteration && state.iteration <= lastMomentumIteration) {
    primeHighMomentumAttack(state);
  }

  runTick(state);

  if (count === TICKS_PER_HALF - 1) {
    emitFullTime(state);
  }

  ticks.push(toMatchTick(state));
}

assertHighMomentumAttack(ticks);

const snapshot = buildSnapshot(state, config, ticks);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced high-momentum attack snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function primeHighMomentumAttack(state: MutableMatchState): void {
  const carrier = requiredPlayer(state, forcedCarrierId);
  carrier.position = [555, 735];
  state.players.forEach((player) => {
    player.hasBall = player.id === carrier.id;
  });
  carrier.hasBall = true;
  state.ball.carrierPlayerId = carrier.id;
  state.ball.position = [carrier.position[0], carrier.position[1], 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "medium" };
  state.possessionStreak = { teamId: "home", ticks: 18 };
  state.attackMomentum.home = Math.max(state.attackMomentum.home, 78);
  state.attackMomentum.away = Math.min(state.attackMomentum.away, 10);
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function assertHighMomentumAttack(ticks: MatchTick[]): void {
  const momentumTicks = ticks.filter((tick) => (tick.attackMomentum?.home ?? 0) >= 65);
  const supportTicks = momentumTicks.filter(
    (tick) => (tick.diagnostics?.shape.home.oppositionHalfPlayers ?? 0) >= 3
  );

  if (momentumTicks.length < 10) {
    throw new Error("Expected at least 10 high-momentum Liverpool ticks");
  }
  if (supportTicks.length < 5) {
    throw new Error("Expected high-momentum ticks with Liverpool support beyond halfway");
  }
}
