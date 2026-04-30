import { PITCH_LENGTH } from "../calibration/constants";

export type PitchZone = "def" | "mid" | "att";

export function getPlayerZone(y: number, teamId: "home" | "away"): PitchZone {
  const threshold1 = PITCH_LENGTH / 3;
  const threshold2 = (PITCH_LENGTH / 3) * 2;

  // Home goal is y=0. So attacking zone for home is y > threshold2
  if (teamId === "home") {
    if (y < threshold1) return "def";
    if (y < threshold2) return "mid";
    return "att";
  } else {
    // Away goal is y=1050. So attacking zone for away is y < threshold1
    if (y > threshold2) return "def";
    if (y > threshold1) return "mid";
    return "att";
  }
}
