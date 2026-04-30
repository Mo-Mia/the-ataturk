import { PITCH_WIDTH, PITCH_LENGTH } from "../calibration/constants";
import type { MutablePlayer } from "../state/matchState";

// Using the coordinates known from politics layer (assumes starting at y=0, x=0 bottom-left or top-left)
// We will flip the Away team to start at y=1050 facing y=0.

export const FORMATIONS: Record<string, [number, number][]> = {
  "4-4-2": [
    [340, 20],   // GK
    [600, 150],  // RB
    [430, 150],  // CB
    [250, 150],  // CB
    [80,  150],  // LB
    [600, 350],  // RM
    [420, 310],  // CM
    [260, 310],  // CM
    [80,  350],  // LM
    [420, 500],  // ST
    [260, 500]   // ST
  ],
  "4-3-1-2": [
    [340, 20],   // GK
    [600, 150],  // RB
    [430, 150],  // CB
    [250, 150],  // CB
    [80,  150],  // LB
    [470, 300],  // DM/RCM
    [340, 270],  // DM
    [210, 300],  // DM/LCM
    [340, 420],  // AM
    [275, 525],  // ST
    [405, 525]   // ST
  ]
};

// Fallback to 4-4-2 if not found
export function getFormationPositions(formationName: string): [number, number][] {
  return FORMATIONS[formationName] || FORMATIONS["4-4-2"]!;
}

export function positionTeam(players: MutablePlayer[], formationName: string) {
  const template = getFormationPositions(formationName);
  
  for (let i = 0; i < players.length; i++) {
    const p = players[i]!;
    // Default assignment if length > 11 fallback gracefully
    const pos = template[i] || template[template.length - 1]!;
    
    // Base template coordinates
    let tx = pos[0];
    let ty = pos[1];

    if (p.teamId === "away") {
      // Mirror vertically and horizontally
      tx = PITCH_WIDTH - tx;
      ty = PITCH_LENGTH - ty;
    }

    p.position = [tx, ty];
    p.targetPosition = [tx, ty];
  }
}
