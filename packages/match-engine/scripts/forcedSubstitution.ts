import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import type { MatchConfigV2, MatchTick } from "../src/types";
import { createTestConfigV2, createTestPlayerV2 } from "../test/helpers";
import { simulateMatch } from "../src";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-substitution-v2.json"
);
const config = withForcedSubstitutionBench(
  createTestConfigV2(782, { preferredFoot: "right", weakFootRating: 4 })
);
const snapshot = simulateMatch(config);

assertSubstitution(snapshot.ticks);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced substitution snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function withForcedSubstitutionBench(config: MatchConfigV2): MatchConfigV2 {
  const bench = ["GK", "CB", "LB", "CM", "AM", "RW", "ST"].map((position, index) =>
    createTestPlayerV2(
      `home-sub-${index}`,
      `Home Sub ${index}`,
      `HS${index}`,
      position as Parameters<typeof createTestPlayerV2>[3],
      index + 12,
      75
    )
  );

  return {
    ...config,
    duration: "full_90",
    dynamics: { fatigue: true, scoreState: true, autoSubs: false },
    homeTeam: { ...config.homeTeam, bench },
    awayTeam: { ...config.awayTeam, bench: [] },
    scheduledSubstitutions: [
      {
        teamId: "home",
        playerOutId: "home-5",
        playerInId: "home-sub-5",
        minute: 60
      }
    ]
  };
}

function assertSubstitution(ticks: MatchTick[]): void {
  const event = ticks
    .flatMap((tick) => tick.events)
    .find(
      (candidate) =>
        candidate.type === "substitution" &&
        candidate.team === "home" &&
        candidate.detail?.playerOutId === "home-5" &&
        candidate.detail?.playerInId === "home-sub-5"
    );
  const finalTick = ticks.at(-1);
  if (!event) {
    throw new Error("Expected forced home substitution event");
  }
  if (finalTick?.players.find((player) => player.id === "home-5")?.onPitch !== false) {
    throw new Error("Expected substituted-out player to be off the pitch");
  }
  if (finalTick?.players.find((player) => player.id === "home-sub-5")?.onPitch !== true) {
    throw new Error("Expected substitute to be on the pitch");
  }
}
