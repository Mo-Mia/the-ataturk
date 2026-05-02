import type { Position } from "@the-ataturk/match-engine";

import type { Fc25Position, Fc25SquadPlayer } from "../types";

export type SupportedFormation = "4-4-2" | "4-3-1-2" | "4-3-3" | "4-2-3-1";

const FORMATION_TEMPLATES: Record<SupportedFormation, readonly Position[]> = {
  "4-4-2": ["GK", "RB", "CB", "CB", "LB", "RM", "CM", "CM", "LM", "ST", "ST"],
  "4-3-1-2": ["GK", "RB", "CB", "CB", "LB", "CM", "DM", "CM", "AM", "ST", "ST"],
  "4-3-3": ["GK", "LB", "CB", "CB", "RB", "DM", "CM", "CM", "LW", "ST", "RW"],
  "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "DM", "DM", "LW", "AM", "RW", "ST"]
};

const ADJACENT_POSITIONS: Record<Position, readonly Fc25Position[]> = {
  GK: [],
  LB: ["CB", "RB"],
  RB: ["CB", "LB"],
  CB: ["RB", "LB", "DM"],
  DM: ["CM", "CB", "AM"],
  CM: ["DM", "AM", "LM", "RM"],
  AM: ["CM", "LW", "RW", "ST"],
  LM: ["LW", "CM", "AM", "RM"],
  RM: ["RW", "CM", "AM", "LM"],
  LW: ["LM", "RW", "ST", "AM"],
  RW: ["RM", "LW", "ST", "AM"],
  ST: ["LW", "RW", "AM"]
};

export class Fc25LineupSelectionError extends Error {
  readonly formation: string;
  readonly role: Position;

  constructor(formation: string, role: Position) {
    super(`Could not select a ${role} for formation ${formation}`);
    this.name = "Fc25LineupSelectionError";
    this.formation = formation;
    this.role = role;
  }
}

export function selectStartingXI(
  squad: readonly Fc25SquadPlayer[],
  formation: SupportedFormation
): Fc25SquadPlayer[] {
  const roles = FORMATION_TEMPLATES[formation];
  const selected = new Set<string>();

  return roles.map((role) => {
    const player = selectPlayerForRole(squad, selected, formation, role);
    selected.add(player.id);
    return {
      ...player,
      position: role
    };
  });
}

export function supportedFormation(value: string): value is SupportedFormation {
  return Object.hasOwn(FORMATION_TEMPLATES, value);
}

export function formationRoles(formation: SupportedFormation): readonly Position[] {
  return FORMATION_TEMPLATES[formation];
}

export function fallbackAdjacency(): Record<Position, readonly Fc25Position[]> {
  return ADJACENT_POSITIONS;
}

function selectPlayerForRole(
  squad: readonly Fc25SquadPlayer[],
  selected: Set<string>,
  formation: SupportedFormation,
  role: Position
): Fc25SquadPlayer {
  const available = squad.filter((player) => !selected.has(player.id));
  const exact = bestPlayer(available.filter((player) => player.sourcePosition === role));
  if (exact) {
    return exact;
  }

  const alternative = bestPlayer(
    available.filter((player) => player.alternativePositions.includes(role))
  );
  if (alternative) {
    return alternative;
  }

  const adjacent = ADJACENT_POSITIONS[role];
  const fallback = bestPlayer(
    available.filter(
      (player) =>
        player.sourcePosition !== "GK" &&
        adjacent.some(
          (position) =>
            player.sourcePosition === position || player.alternativePositions.includes(position)
        )
    )
  );
  if (fallback) {
    return fallback;
  }

  throw new Fc25LineupSelectionError(formation, role);
}

function bestPlayer(players: Fc25SquadPlayer[]): Fc25SquadPlayer | null {
  return (
    players.sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id))[0] ?? null
  );
}
