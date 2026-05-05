import type { PlayerInputV2 } from "@the-ataturk/match-engine";

import type { Fc25ParsedPlayerRow } from "../types";

/**
 * Convert a parsed FC25 CSV row into the match-engine v2 input shape.
 *
 * @param row Parsed FC25 or FC26 player row from the CSV importer.
 * @returns Match-engine v2 player input preserving rich attribute groups.
 *
 * This adapter deliberately stops at CSV row -> v2 player. The match engine's
 * own v2 -> v1 bridge remains the only place where rich FC25 attributes are
 * collapsed into calibrated simulation attributes.
 */
export function adaptFc25RowToPlayerInputV2(row: Fc25ParsedPlayerRow): PlayerInputV2 {
  return {
    id: row.fc25PlayerId,
    name: row.name,
    shortName: shortNameFor(row.name),
    position: row.position,
    height: row.heightCm,
    weight: row.weightKg,
    age: row.age,
    preferredFoot: row.preferredFoot,
    weakFootRating: row.weakFootRating,
    skillMovesRating: row.skillMovesRating,
    attributes: {
      acceleration: row.attributes.acceleration,
      sprintSpeed: row.attributes.sprintSpeed,
      finishing: row.attributes.finishing,
      shotPower: row.attributes.shotPower,
      longShots: row.attributes.longShots,
      positioning: row.attributes.positioning,
      volleys: row.attributes.volleys,
      penalties: row.attributes.penalties,
      vision: row.attributes.vision,
      crossing: row.attributes.crossing,
      freeKickAccuracy: row.attributes.freeKickAccuracy,
      shortPassing: row.attributes.shortPassing,
      longPassing: row.attributes.longPassing,
      curve: row.attributes.curve,
      dribbling: row.attributes.dribbling,
      agility: row.attributes.agility,
      balance: row.attributes.balance,
      reactions: row.attributes.reactions,
      ballControl: row.attributes.ballControl,
      composure: row.attributes.composure,
      interceptions: row.attributes.interceptions,
      headingAccuracy: row.attributes.headingAccuracy,
      defensiveAwareness: row.attributes.defensiveAwareness,
      standingTackle: row.attributes.standingTackle,
      slidingTackle: row.attributes.slidingTackle,
      jumping: row.attributes.jumping,
      stamina: row.attributes.stamina,
      strength: row.attributes.strength,
      aggression: row.attributes.aggression
    },
    ...(row.gkAttributes
      ? {
          gkAttributes: {
            gkDiving: row.gkAttributes.gkDiving,
            gkHandling: row.gkAttributes.gkHandling,
            gkKicking: row.gkAttributes.gkKicking,
            gkPositioning: row.gkAttributes.gkPositioning,
            gkReflexes: row.gkAttributes.gkReflexes
          }
        }
      : {})
  };
}

function shortNameFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.at(-1) ?? name;
}
