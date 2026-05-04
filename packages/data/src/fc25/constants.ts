import type { Fc25ClubDefinition, Fc25Position, Fc25SourcePosition } from "../types";

export const FC25_SOURCE_FILE_DEFAULT = "data/fc-25/male_players.csv";

export const FC25_CLUBS = [
  {
    id: "arsenal",
    name: "Arsenal",
    shortName: "ARS",
    country: "England",
    league: "Premier League",
    sourceTeam: "Arsenal"
  },
  {
    id: "manchester-city",
    name: "Manchester City",
    shortName: "MCI",
    country: "England",
    league: "Premier League",
    sourceTeam: "Manchester City"
  },
  {
    id: "manchester-united",
    name: "Manchester United",
    shortName: "MUN",
    country: "England",
    league: "Premier League",
    sourceTeam: "Man Utd",
    sourceTeamAliases: ["Manchester United"]
  },
  {
    id: "liverpool",
    name: "Liverpool",
    shortName: "LIV",
    country: "England",
    league: "Premier League",
    sourceTeam: "Liverpool"
  },
  {
    id: "aston-villa",
    name: "Aston Villa",
    shortName: "AVL",
    country: "England",
    league: "Premier League",
    sourceTeam: "Aston Villa"
  }
] as const satisfies readonly Fc25ClubDefinition[];

export const FC25_SOURCE_TO_ENGINE_POSITION: Record<Fc25SourcePosition, Fc25Position> = {
  GK: "GK",
  CB: "CB",
  LB: "LB",
  RB: "RB",
  CDM: "DM",
  CM: "CM",
  CAM: "AM",
  LM: "LM",
  RM: "RM",
  LW: "LW",
  RW: "RW",
  ST: "ST"
};

export const FC25_SOURCE_TEAM_NAMES = FC25_CLUBS.map((club) => club.sourceTeam);
