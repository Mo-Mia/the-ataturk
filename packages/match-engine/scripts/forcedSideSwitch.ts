import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_FULL_MATCH } from "../src/calibration/constants";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import type { MutableMatchState, MutablePlayer } from "../src/state/matchState";
import { runTick } from "../src/ticks/runTick";
import type { MatchConfigV2, MatchTick } from "../src/types";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-side-switch-v2.json"
);
const config = fullMatchConfig(
  createTestConfigV2(923, { preferredFoot: "right", weakFootRating: 4 })
);
const state = buildInitState(config);
const ticks: MatchTick[] = [];

for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
  if (state.iteration >= 895 && state.iteration < 900) {
    primePreHalfTimePossession(state);
  }

  runTick(state);

  if (count === TICKS_PER_FULL_MATCH - 1) {
    emitFullTime(state);
  }

  ticks.push(toMatchTick(state));
}

const snapshot = buildSnapshot(state, config, ticks);
assertSideSwitch(snapshot.ticks);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced side-switch snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function fullMatchConfig(config: MatchConfigV2): MatchConfigV2 {
  return {
    homeTeam: config.homeTeam,
    awayTeam: config.awayTeam,
    seed: config.seed,
    duration: "full_90",
    dynamics: { fatigue: true, scoreState: true, autoSubs: true, sideSwitch: true }
  };
}

function primePreHalfTimePossession(state: MutableMatchState): void {
  const carrier = requiredPlayer(state, "home-8");
  state.pendingGoal = null;
  state.pendingSetPiece = null;
  carrier.position = [150, 720];
  state.players.forEach((player) => {
    player.hasBall = player.id === carrier.id;
  });
  state.ball.carrierPlayerId = carrier.id;
  state.ball.position = [carrier.position[0], carrier.position[1], 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
}

function requiredPlayer(state: MutableMatchState, playerId: string): MutablePlayer {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function assertSideSwitch(ticks: MatchTick[]): void {
  const halfTimeTick = ticks[899];
  const secondHalfTick = ticks[900];
  const events = ticks.flatMap((tick) => tick.events);
  const halfTime = events.find((event) => event.type === "half_time");
  const secondHalfKickoff = events.find(
    (event) => event.type === "kick_off" && event.team === "away" && event.detail?.secondHalf
  );

  if (!halfTime || !secondHalfKickoff) {
    throw new Error("Expected half-time and second-half kickoff events");
  }
  if (halfTimeTick?.attackDirection?.home !== -1 || halfTimeTick.attackDirection.away !== 1) {
    throw new Error("Expected home/away attacking directions to flip on the half-time tick");
  }
  if (secondHalfTick?.attackDirection?.home !== -1 || secondHalfTick.attackDirection.away !== 1) {
    throw new Error("Expected second-half ticks to retain flipped attacking directions");
  }
  const awayCarrier = secondHalfTick.players.find(
    (player) => player.hasBall && player.teamId === "away"
  );
  if (!awayCarrier || awayCarrier.position[1] !== 525) {
    throw new Error("Expected away to take the second-half kickoff from the centre circle");
  }
}
