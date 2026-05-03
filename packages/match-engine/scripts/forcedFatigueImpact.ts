import { gzipSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

import { simulateMatch } from "../src";
import type { MatchConfigV2 } from "../src/types";
import { createTestConfigV2 } from "../test/helpers";

const outputPath = resolve(
  process.argv.slice(2).find((arg) => arg !== "--") ?? "artifacts/forced-fatigue-impact-v2.json"
);
const config = lowStaminaFullMatch(createTestConfigV2(783));
const snapshot = simulateMatch(config);

assertFatigue(snapshot.finalSummary.endStamina?.home ?? []);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(`${outputPath}.gz`, gzipSync(`${JSON.stringify(snapshot)}\n`));

console.log(`Wrote forced fatigue-impact snapshot to ${outputPath}`);
console.log(`Wrote compressed snapshot to ${outputPath}.gz`);

function lowStaminaFullMatch(config: MatchConfigV2): MatchConfigV2 {
  return {
    ...config,
    duration: "full_90",
    dynamics: { fatigue: true, scoreState: false, autoSubs: false },
    homeTeam: {
      ...config.homeTeam,
      players: config.homeTeam.players.map((player, index) => ({
        ...player,
        attributes: {
          ...player.attributes,
          stamina: index === 0 ? 90 : 12
        }
      }))
    }
  };
}

function assertFatigue(stamina: Array<{ playerId: string; stamina: number }>): void {
  const outfield = stamina.filter((player) => player.playerId !== "home-0");
  if (!outfield.some((player) => player.stamina < 45)) {
    throw new Error("Expected low-stamina outfield players to show severe late-match fatigue");
  }
}
