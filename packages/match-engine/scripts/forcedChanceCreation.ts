import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_FULL_MATCH } from "../src/calibration/constants";
import { performPass } from "../src/resolution/actions/pass";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import { runTick } from "../src/ticks/runTick";
import type { MatchTick } from "../src/types";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-chance-creation-v2.json"
);
const config = {
  ...createTestConfigV2(906, { preferredFoot: "right", weakFootRating: 4 }),
  duration: "full_90",
  dynamics: { fatigue: true, scoreState: true, autoSubs: true, chanceCreation: true }
} as const;
const state = buildInitState(config);
const ticks: MatchTick[] = [];

for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
  if (state.matchClock.minute === 74 && state.matchClock.seconds === 57) {
    forceProgressiveChance();
  } else {
    runTick(state);
  }
  if (count === TICKS_PER_FULL_MATCH - 1) {
    emitFullTime(state);
  }
  ticks.push(toMatchTick(state));
}

const snapshot = buildSnapshot(state, config, ticks);
assertChanceCreation();
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced chance-creation snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function forceProgressiveChance(): void {
  const carrier = requiredPlayer("home-6");
  const striker = requiredPlayer("home-9");
  const keeper = requiredPlayer("away-0");
  state.players.forEach((player) => {
    player.hasBall = player.id === carrier.id;
    player.onPitch = player.onPitch && ["home", "away"].includes(player.teamId);
  });
  const direction = state.attackDirection.home;
  carrier.position = [330, direction === 1 ? 655 : 395];
  striker.position = [340, carrier.position[1] + direction * 180];
  keeper.baseInput.attributes.saving = 0;
  carrier.baseInput.attributes.passing = 100;
  striker.baseInput.attributes.shooting = 100;
  striker.baseInput.attributes.perception = 100;
  state.ball.carrierPlayerId = carrier.id;
  state.ball.position = [carrier.position[0], carrier.position[1], 0];
  state.ball.inFlight = false;
  state.possession = { teamId: "home", zone: "att", pressureLevel: "low" };
  state.rng.int = () => 0;
  state.rng.next = () => 0;
  state.eventsThisTick = [];
  performPass(state, carrier);
}

function requiredPlayer(playerId: string) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Expected player ${playerId} to exist`);
  }
  return player;
}

function assertChanceCreation(): void {
  const events = snapshot.ticks.flatMap((tick) => tick.events);
  if (!events.some((event) => event.type === "chance_created" && event.team === "home")) {
    throw new Error("Expected a home chance-created event");
  }
  if (
    !events.some(
      (event) =>
        event.type === "shot" &&
        event.team === "home" &&
        event.detail?.setPieceContext === undefined &&
        event.detail?.chanceSource
    )
  ) {
    throw new Error("Expected the chance-created sequence to resolve into a shot");
  }
}
