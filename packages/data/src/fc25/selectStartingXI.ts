import type { Position } from "@the-ataturk/match-engine";

import type {
  Fc25Position,
  Fc25SquadPlayer,
  LineupRoleFit,
  LineupSelectionMode,
  MatchRunLineupWarning
} from "../types";

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

/**
 * Error raised when a squad cannot satisfy the requested FC25 lineup shape.
 */
export class Fc25LineupSelectionError extends Error {
  readonly formation: string;
  readonly role?: Position;

  constructor(formation: string, role: Position, message?: string) {
    super(message ?? `Could not select a ${role} for formation ${formation}`);
    this.name = "Fc25LineupSelectionError";
    this.formation = formation;
    this.role = role;
  }
}

export interface LineupAssignment {
  role: Position;
  playerId: string;
  fit: LineupRoleFit;
}

export interface LineupSelectionResult {
  mode: LineupSelectionMode;
  xi: Fc25SquadPlayer[];
  bench: Fc25SquadPlayer[];
  assignments: LineupAssignment[];
  warnings: MatchRunLineupWarning[];
}

/**
 * Select an automatic starting XI for a supported formation.
 *
 * @param squad Candidate FC25 squad players.
 * @param formation Supported tactical formation.
 * @returns Eleven players assigned to formation roles.
 * @throws Fc25LineupSelectionError when no valid role coverage can be found.
 */
export function selectStartingXI(
  squad: readonly Fc25SquadPlayer[],
  formation: SupportedFormation
): Fc25SquadPlayer[] {
  return selectLineup(squad, formation).xi;
}

/**
 * Select an FC25 lineup either automatically or from a validated manual XI.
 *
 * @param squad Candidate FC25 squad players.
 * @param formation Supported tactical formation.
 * @param manualPlayerIds Optional ordered manual XI player ids.
 * @returns XI, bench, role assignments, and lineup warnings.
 * @throws Fc25LineupSelectionError when the requested manual or automatic XI is invalid.
 */
export function selectLineup(
  squad: readonly Fc25SquadPlayer[],
  formation: SupportedFormation,
  manualPlayerIds?: readonly string[]
): LineupSelectionResult {
  if (!manualPlayerIds) {
    const xi = selectAutoXi(squad, formation);
    return resultFor("auto", squad, formation, xi);
  }

  const manualXi = selectedManualPlayers(squad, formation, manualPlayerIds);
  return resultFor("manual", squad, formation, manualXi);
}

/**
 * Select the strongest bench outside the starting XI.
 *
 * @param squad Full available squad.
 * @param xi Starting players to exclude.
 * @param size Maximum bench size.
 * @returns Bench players ordered by rating.
 */
export function selectBench(
  squad: readonly Fc25SquadPlayer[],
  xi: readonly Fc25SquadPlayer[],
  size = 7
): Fc25SquadPlayer[] {
  const starterIds = new Set(xi.map((player) => player.id));
  return [...squad]
    .filter((player) => !starterIds.has(player.id))
    .sort(comparePlayers)
    .slice(0, size);
}

/**
 * Check whether a string is one of the supported FC25 formation templates.
 *
 * @param value Formation string to validate.
 * @returns True when the value is a supported formation.
 */
export function supportedFormation(value: string): value is SupportedFormation {
  return Object.hasOwn(FORMATION_TEMPLATES, value);
}

/**
 * Return the engine role sequence for a supported FC25 formation.
 *
 * @param formation Supported formation.
 * @returns Ordered role template used for lineup assignment.
 */
export function formationRoles(formation: SupportedFormation): readonly Position[] {
  return FORMATION_TEMPLATES[formation];
}

/**
 * Return the source-position adjacency map used for fallback lineup coverage.
 *
 * @returns Mapping from engine roles to acceptable nearby FC25 source positions.
 */
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

function selectAutoXi(
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

function selectedManualPlayers(
  squad: readonly Fc25SquadPlayer[],
  formation: SupportedFormation,
  playerIds: readonly string[]
): Fc25SquadPlayer[] {
  if (playerIds.length !== 11) {
    throw new Fc25LineupSelectionError(
      formation,
      "GK",
      `Manual XI must contain exactly 11 players; received ${playerIds.length}`
    );
  }

  const uniqueIds = new Set(playerIds);
  if (uniqueIds.size !== playerIds.length) {
    throw new Fc25LineupSelectionError(formation, "GK", "Manual XI contains duplicate players");
  }

  const playersById = new Map(squad.map((player) => [player.id, player]));
  const selected = playerIds.map((playerId) => {
    const player = playersById.get(playerId);
    if (!player) {
      throw new Fc25LineupSelectionError(
        formation,
        "GK",
        `Manual XI contains unknown player '${playerId}'`
      );
    }
    return player;
  });

  const goalkeeperCount = selected.filter((player) => player.sourcePosition === "GK").length;
  if (goalkeeperCount !== 1) {
    throw new Fc25LineupSelectionError(
      formation,
      "GK",
      `Manual XI must contain exactly one goalkeeper; received ${goalkeeperCount}`
    );
  }

  return selected;
}

function resultFor(
  mode: LineupSelectionMode,
  squad: readonly Fc25SquadPlayer[],
  formation: SupportedFormation,
  selectedPlayers: readonly Fc25SquadPlayer[]
): LineupSelectionResult {
  const assigned = assignRoles(selectedPlayers, formation);
  const xi = assigned.map(({ player, role }) => ({ ...player, position: role }));
  const assignments = assigned.map(({ role, player, fit }) => ({
    role,
    playerId: player.id,
    fit
  }));
  const warnings = assigned
    .filter(({ fit }) => fit === "adjacent" || fit === "out_of_position")
    .map(({ role, player, fit }) => ({
      code: fit === "adjacent" ? ("adjacent_fit" as const) : ("out_of_position" as const),
      playerId: player.id,
      playerName: player.name,
      role,
      sourcePosition: player.sourcePosition,
      message:
        fit === "adjacent"
          ? `${player.shortName} is covering ${role} from ${player.sourcePosition}`
          : `${player.shortName} is out of position at ${role} from ${player.sourcePosition}`
    }));

  return {
    mode,
    xi,
    bench: selectBench(squad, xi),
    assignments,
    warnings
  };
}

function assignRoles(
  players: readonly Fc25SquadPlayer[],
  formation: SupportedFormation
): Array<{ role: Position; player: Fc25SquadPlayer; fit: LineupRoleFit }> {
  const available = [...players];

  return FORMATION_TEMPLATES[formation].map((role) => {
    const candidate = bestRoleCandidate(available, role);
    if (!candidate) {
      throw new Fc25LineupSelectionError(formation, role);
    }
    available.splice(available.findIndex((player) => player.id === candidate.player.id), 1);
    return candidate;
  });
}

function bestRoleCandidate(
  players: readonly Fc25SquadPlayer[],
  role: Position
): { role: Position; player: Fc25SquadPlayer; fit: LineupRoleFit } | null {
  const candidates = players
    .map((player) => ({ role, player, fit: roleFit(player, role), fitRank: roleFitRank(player, role) }))
    .filter((candidate) => candidate.fitRank < Number.POSITIVE_INFINITY)
    .sort(
      (a, b) =>
        a.fitRank - b.fitRank ||
        b.player.overall - a.player.overall ||
        a.player.id.localeCompare(b.player.id)
    );

  return candidates[0] ?? null;
}

function roleFit(player: Fc25SquadPlayer, role: Position): LineupRoleFit {
  if (player.sourcePosition === role) {
    return "exact";
  }
  if (player.alternativePositions.includes(role)) {
    return "alternative";
  }
  if (
    role !== "GK" &&
    player.sourcePosition !== "GK" &&
    ADJACENT_POSITIONS[role].some(
      (position) =>
        player.sourcePosition === position || player.alternativePositions.includes(position)
    )
  ) {
    return "adjacent";
  }
  return "out_of_position";
}

function roleFitRank(player: Fc25SquadPlayer, role: Position): number {
  const fit = roleFit(player, role);
  if (role === "GK" && fit !== "exact") {
    return Number.POSITIVE_INFINITY;
  }
  return { exact: 0, alternative: 1, adjacent: 2, out_of_position: 3 }[fit];
}

function bestPlayer(players: Fc25SquadPlayer[]): Fc25SquadPlayer | null {
  return players.sort(comparePlayers)[0] ?? null;
}

function comparePlayers(a: Fc25SquadPlayer, b: Fc25SquadPlayer): number {
  return b.overall - a.overall || a.id.localeCompare(b.id);
}
