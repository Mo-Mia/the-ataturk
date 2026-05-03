import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { TICKS_PER_FULL_MATCH } from "../src/calibration/constants";
import { awardCorner, awardPenalty } from "../src/resolution/setPieces";
import { buildSnapshot, emitFullTime, toMatchTick } from "../src/snapshot";
import { buildInitState } from "../src/state/initState";
import { runTick } from "../src/ticks/runTick";
import type { MatchTick } from "../src/types";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ??
    "artifacts/forced-set-piece-conversion-v2.json"
);
const config = {
  ...createTestConfigV2(907, { preferredFoot: "right", weakFootRating: 4 }),
  duration: "full_90",
  dynamics: { fatigue: true, scoreState: true, autoSubs: true, setPieces: true }
} as const;
const state = buildInitState(config);
const ticks: MatchTick[] = [];

for (let count = 0; count < TICKS_PER_FULL_MATCH; count += 1) {
  if (state.matchClock.minute === 63 && state.matchClock.seconds === 0) {
    forceCorner();
  } else if (state.matchClock.minute === 72 && state.matchClock.seconds === 0) {
    forcePenalty();
  } else {
    runTick(state);
  }
  if (count === TICKS_PER_FULL_MATCH - 1) {
    emitFullTime(state);
  }
  ticks.push(toMatchTick(state));
}

const snapshot = buildSnapshot(state, config, ticks);
assertSetPieces();
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced set-piece snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function forceCorner(): void {
  boostHomeTakers();
  state.rng.int = () => 0;
  state.rng.next = () => 0;
  state.eventsThisTick = [];
  awardCorner(state, "home", [620, 1040], "deflected_shot", "away-2");
  runTick(state);
  runTick(state);
  runTick(state);
}

function forcePenalty(): void {
  boostHomeTakers();
  const keeper = state.players.find(
    (player) => player.teamId === "away" && player.baseInput.position === "GK"
  );
  if (keeper) {
    keeper.baseInput.attributes.saving = 0;
  }
  state.rng.next = () => 0;
  state.eventsThisTick = [];
  awardPenalty(state, "home", "away-4", "home-9");
  runTick(state);
  runTick(state);
  runTick(state);
}

function boostHomeTakers(): void {
  for (const player of state.players.filter((candidate) => candidate.teamId === "home")) {
    player.baseInput.attributes.passing = 100;
    player.baseInput.attributes.shooting = 100;
    player.baseInput.attributes.penaltyTaking = 100;
    player.baseInput.attributes.perception = 100;
    player.baseInput.attributes.jumping = 100;
    player.baseInput.attributes.strength = 100;
  }
}

function assertSetPieces(): void {
  const events = snapshot.ticks.flatMap((tick) => tick.events);
  if (!events.some((event) => event.type === "corner_taken" && event.team === "home")) {
    throw new Error("Expected a home corner-taken event");
  }
  if (!events.some((event) => event.type === "penalty_taken" && event.team === "home")) {
    throw new Error("Expected a home penalty-taken event");
  }
  if ((snapshot.finalSummary.setPieces?.home.setPieceShots ?? 0) < 2) {
    throw new Error("Expected forced set pieces to produce set-piece shots");
  }
}
