import type { Coordinate2D, TeamInput } from "@the-ataturk/engine";

export type FormationName = "4-4-2" | "4-3-1-2";

export const LIVERPOOL_FORMATION: readonly Coordinate2D[] = [
  [340, 0],
  [600, 95],
  [430, 95],
  [250, 95],
  [80, 95],
  [600, 300],
  [420, 285],
  [260, 285],
  [80, 300],
  [420, 500],
  [260, 500]
] as const;

export const MILAN_FORMATION: readonly Coordinate2D[] = [
  [340, 0],
  [600, 95],
  [430, 95],
  [250, 95],
  [80, 95],
  [470, 280],
  [340, 250],
  [210, 280],
  [340, 405],
  [275, 520],
  [405, 520]
] as const;

const FORMATION_TEMPLATES = {
  "4-4-2": LIVERPOOL_FORMATION,
  "4-3-1-2": MILAN_FORMATION
} as const satisfies Record<FormationName, readonly Coordinate2D[]>;

export function applyFormation(team: TeamInput, formation: FormationName): TeamInput {
  if (team.players.length !== 11) {
    throw new Error("Formation translation requires exactly 11 players");
  }

  const template = FORMATION_TEMPLATES[formation];

  return {
    ...team,
    players: team.players.map((player, index) => ({
      ...player,
      currentPOS: [...template[index]!] as Coordinate2D
    }))
  };
}
