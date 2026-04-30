import type { MatchConfig, PlayerInput, Team, TeamTactics } from "../src";

export function createTestTeam(
  id: string,
  name: string,
  tactics: Partial<TeamTactics> = {},
  attributeValue = 70
): Team {
  const positions: PlayerInput["position"][] = [
    "GK",
    "RB",
    "CB",
    "CB",
    "LB",
    "RW",
    "CM",
    "CM",
    "LW",
    "ST",
    "ST"
  ];

  return {
    id,
    name,
    shortName: name.slice(0, 3).toUpperCase(),
    players: positions.map((position, index) => ({
      id: `${id}-${index}`,
      name: `${name} ${index}`,
      shortName: `${position}${index}`,
      squadNumber: index + 1,
      position,
      attributes: {
        passing: attributeValue,
        shooting: position === "GK" ? 25 : attributeValue,
        tackling: position === "ST" ? 50 : attributeValue,
        saving: position === "GK" ? attributeValue + 10 : 10,
        agility: attributeValue,
        strength: attributeValue,
        penaltyTaking: attributeValue,
        perception: attributeValue,
        jumping: attributeValue,
        control: attributeValue
      }
    })),
    tactics: {
      formation: "4-4-2",
      mentality: "balanced",
      tempo: "normal",
      pressing: "medium",
      lineHeight: "normal",
      width: "normal",
      ...tactics
    }
  };
}

export function createTestConfig(seed = 1): MatchConfig {
  return {
    homeTeam: createTestTeam("home", "Liverpool", { mentality: "attacking", tempo: "fast" }, 76),
    awayTeam: createTestTeam("away", "Milan", { formation: "4-3-1-2" }, 78),
    duration: "second_half",
    seed,
    preMatchScore: { home: 0, away: 3 }
  };
}
