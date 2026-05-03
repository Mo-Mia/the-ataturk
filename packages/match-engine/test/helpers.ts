import type {
  MatchConfig,
  MatchConfigV2,
  PlayerInput,
  PlayerInputV2,
  Team,
  TeamTactics
} from "../src";

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
    dynamics: { sideSwitch: false },
    preMatchScore: { home: 0, away: 3 }
  };
}

export function createTestConfigV2(
  seed = 1,
  options: {
    preferredFoot?: PlayerInputV2["preferredFoot"];
    weakFootRating?: PlayerInputV2["weakFootRating"];
  } = {}
): MatchConfigV2 {
  return {
    homeTeam: createTestTeamV2(
      "home",
      "Liverpool",
      { mentality: "attacking", tempo: "fast" },
      76,
      options
    ),
    awayTeam: createTestTeamV2("away", "Milan", { formation: "4-3-1-2" }, 78, options),
    duration: "second_half",
    seed,
    dynamics: { sideSwitch: false },
    preMatchScore: { home: 0, away: 3 }
  };
}

export function createTestTeamV2(
  id: string,
  name: string,
  tactics: Partial<TeamTactics> = {},
  attributeValue = 70,
  options: {
    preferredFoot?: PlayerInputV2["preferredFoot"];
    weakFootRating?: PlayerInputV2["weakFootRating"];
  } = {}
): MatchConfigV2["homeTeam"] {
  const positions: PlayerInputV2["position"][] = [
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
    players: positions.map((position, index) =>
      createTestPlayerV2(
        `${id}-${index}`,
        `${name} ${index}`,
        `${position}${index}`,
        position,
        index + 1,
        attributeValue,
        options
      )
    ),
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

export function createTestPlayerV2(
  id: string,
  name: string,
  shortName: string,
  position: PlayerInputV2["position"],
  squadNumber: number,
  base = 75,
  options: {
    preferredFoot?: PlayerInputV2["preferredFoot"];
    weakFootRating?: PlayerInputV2["weakFootRating"];
  } = {}
): PlayerInputV2 {
  const isGoalkeeper = position === "GK";
  const isForward = ["ST", "LW", "RW", "AM"].includes(position);
  const attackingBoost = isForward ? 8 : 0;

  return {
    id,
    name,
    shortName,
    squadNumber,
    position,
    height: isGoalkeeper ? 191 : 181,
    weight: isGoalkeeper ? 84 : 76,
    age: 27,
    preferredFoot: options.preferredFoot ?? "either",
    weakFootRating: options.weakFootRating ?? 3,
    skillMovesRating: isGoalkeeper ? 1 : 3,
    attributes: {
      acceleration: base,
      sprintSpeed: base + (isForward ? 4 : 0),
      finishing: isGoalkeeper ? 20 : base + attackingBoost,
      shotPower: isGoalkeeper ? 35 : base + attackingBoost,
      longShots: isGoalkeeper ? 20 : base + attackingBoost - 2,
      positioning: isGoalkeeper ? 25 : base + attackingBoost,
      volleys: isGoalkeeper ? 20 : base,
      penalties: base,
      vision: base + (position === "CM" ? 6 : 0),
      crossing: ["LW", "RW", "LB", "RB"].includes(position) ? base + 8 : base - 2,
      freeKickAccuracy: base - 2,
      shortPassing: base + (position === "CM" ? 6 : 0),
      longPassing: base + (position === "CM" ? 6 : 0),
      curve: base,
      dribbling: isGoalkeeper ? 25 : base + attackingBoost,
      agility: base,
      balance: base,
      reactions: base,
      ballControl: isGoalkeeper ? 35 : base + attackingBoost,
      composure: base,
      interceptions: base,
      headingAccuracy: base,
      defensiveAwareness: ["CB", "LB", "RB", "DM"].includes(position) ? base + 8 : base - 4,
      standingTackle: ["CB", "LB", "RB", "DM"].includes(position) ? base + 8 : base - 4,
      slidingTackle: ["CB", "LB", "RB", "DM"].includes(position) ? base + 6 : base - 6,
      jumping: base,
      stamina: base,
      strength: ["CB", "ST", "GK"].includes(position) ? base + 6 : base,
      aggression: base
    },
    ...(isGoalkeeper
      ? {
          gkAttributes: {
            gkDiving: base + 8,
            gkHandling: base + 6,
            gkKicking: base + 4,
            gkPositioning: base + 8,
            gkReflexes: base + 10
          }
        }
      : {})
  };
}
