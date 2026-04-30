import { PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
import type { Coordinate2D } from "../types";
import type { MutablePlayer } from "../state/matchState";

const KNOWN_FORMATIONS: Record<string, readonly Coordinate2D[]> = {
  "4-4-2": [
    [340, 35],
    [600, 150],
    [430, 150],
    [250, 150],
    [80, 150],
    [600, 350],
    [420, 320],
    [260, 320],
    [80, 350],
    [420, 505],
    [260, 505]
  ],
  "4-3-1-2": [
    [340, 35],
    [600, 150],
    [430, 150],
    [250, 150],
    [80, 150],
    [470, 300],
    [340, 275],
    [210, 300],
    [340, 430],
    [275, 525],
    [405, 525]
  ]
};

export function positionTeam(players: MutablePlayer[], formationName: string): void {
  const template = formationTemplate(formationName, players.length);

  for (let index = 0; index < players.length; index += 1) {
    const player = players[index]!;
    const base = template[index] ??
      template[template.length - 1] ?? [PITCH_WIDTH / 2, PITCH_LENGTH / 2];
    const anchor: Coordinate2D =
      player.teamId === "home"
        ? [base[0], base[1]]
        : [PITCH_WIDTH - base[0], PITCH_LENGTH - base[1]];

    player.anchorPosition = anchor;
    player.position = anchor;
    player.targetPosition = anchor;
  }
}

function formationTemplate(formationName: string, playerCount: number): readonly Coordinate2D[] {
  const known = KNOWN_FORMATIONS[formationName];
  if (known) {
    return known;
  }

  const lines = parseFormation(formationName);
  if (!lines) {
    return KNOWN_FORMATIONS["4-4-2"]!;
  }

  const template: Coordinate2D[] = [[PITCH_WIDTH / 2, 35]];
  const yBands = lines.length === 3 ? [155, 330, 510] : [150, 280, 405, 525];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const count = lines[lineIndex]!;
    const y = yBands[lineIndex] ?? 500;

    for (let slot = 0; slot < count; slot += 1) {
      const x = ((slot + 1) * PITCH_WIDTH) / (count + 1);
      template.push([x, y]);
    }
  }

  while (template.length < playerCount) {
    template.push([PITCH_WIDTH / 2, 500]);
  }

  return template.slice(0, playerCount);
}

function parseFormation(formationName: string): number[] | null {
  const parts = formationName.split("-").map((part) => Number(part));
  const valid = parts.length >= 3 && parts.every((part) => Number.isInteger(part) && part > 0);
  return valid ? parts : null;
}
