import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_HALF } from "../src/calibration/constants";
import { resolveTackleAttempt } from "../src/resolution/actions/tackle";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import type { MatchTick, SemanticEvent } from "../src/types";
import { runTick } from "../src/ticks/runTick";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-second-yellow-v2.json"
);
const config = createTestConfigV2(777, { preferredFoot: "left", weakFootRating: 3 });
const state = buildInitState(config);
const ticks: MatchTick[] = [];
const forcedTacklerId = "away-6";
const forcedCarrierId = "home-9";
const forcedIterations = new Set([120, 132]);

for (let count = 0; count < TICKS_PER_HALF; count += 1) {
  runTick(state);

  if (forcedIterations.has(state.iteration)) {
    forceBooking(state);
  }

  if (count === TICKS_PER_HALF - 1) {
    emitFullTime(state);
  }

  ticks.push(toMatchTick(state));
}

assertForcedSecondYellow(ticks);

const snapshot = buildSnapshot(state, config, ticks);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced second-yellow snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function forceBooking(state: MutableMatchState): void {
  const tackler = requiredPlayer(state, forcedTacklerId);
  const carrier = requiredPlayer(state, forcedCarrierId);

  state.pendingSetPiece = null;
  state.players.forEach((player) => {
    player.hasBall = player.id === carrier.id;
  });
  carrier.hasBall = true;
  tackler.position = [carrier.position[0] + 10, carrier.position[1]];
  state.ball.carrierPlayerId = carrier.id;
  state.ball.position = [carrier.position[0], carrier.position[1], 0];
  state.possession = { teamId: carrier.teamId, zone: "mid", pressureLevel: "high" };

  const originalNext = state.rng.next.bind(state.rng);
  const rolls = tackler.yellowCards === 0 ? [0, 0, 1] : [0, 0];
  state.rng.next = () => rolls.shift() ?? 1;
  resolveTackleAttempt(state, tackler, carrier, { carrierAction: "dribble" });
  state.rng.next = originalNext;
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function assertForcedSecondYellow(ticks: MatchTick[]): void {
  const yellowEvents = events(ticks).filter(
    (event) => event.type === "yellow" && event.playerId === forcedTacklerId
  );
  const redEvent = events(ticks).find(
    (event) => event.type === "red" && event.playerId === forcedTacklerId
  );
  const redTickIndex = ticks.findIndex((tick) =>
    tick.events.some((event) => event.type === "red" && event.playerId === forcedTacklerId)
  );

  if (yellowEvents.length !== 2) {
    throw new Error(`Expected exactly two yellow cards for ${forcedTacklerId}`);
  }
  if (yellowEvents[0]?.detail?.cardCount !== 1 || yellowEvents[1]?.detail?.cardCount !== 2) {
    throw new Error("Expected forced yellow cards to carry cardCount 1 then 2");
  }
  if (redEvent?.detail?.reason !== "second_yellow") {
    throw new Error("Expected second yellow to emit a red card with reason second_yellow");
  }
  if (redTickIndex < 0) {
    throw new Error("Expected a red-card tick");
  }

  for (const tick of ticks.slice(redTickIndex)) {
    const sentOffPlayer = tick.players.find((player) => player.id === forcedTacklerId);
    if (sentOffPlayer?.onPitch !== false) {
      throw new Error(`Expected ${forcedTacklerId} to stay off the pitch after red card`);
    }
  }
}

function events(ticks: MatchTick[]): SemanticEvent[] {
  return ticks.flatMap((tick) => tick.events);
}
