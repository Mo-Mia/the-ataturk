import type { Fc25ClubDefinition, Fc25Position, Fc25SourcePosition } from "../types";

export const FC25_SOURCE_FILE_DEFAULT = "data/fc-25/male_players.csv";
export type Fc25ClubUniverse = "footsim" | "pl20";

export const FC25_CLUBS = [
  {
    id: "afc-bournemouth",
    name: "AFC Bournemouth",
    shortName: "BOU",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "AFC Bournemouth"
  },
  {
    id: "arsenal",
    name: "Arsenal",
    shortName: "ARS",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Arsenal"
  },
  {
    id: "aston-villa",
    name: "Aston Villa",
    shortName: "AVL",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Aston Villa"
  },
  {
    id: "brentford",
    name: "Brentford",
    shortName: "BRE",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Brentford"
  },
  {
    id: "brighton",
    name: "Brighton & Hove Albion",
    shortName: "BHA",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Brighton & Hove Albion"
  },
  {
    id: "burnley",
    name: "Burnley",
    shortName: "BUR",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Burnley"
  },
  {
    id: "chelsea",
    name: "Chelsea",
    shortName: "CHE",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Chelsea"
  },
  {
    id: "crystal-palace",
    name: "Crystal Palace",
    shortName: "CRY",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Crystal Palace"
  },
  {
    id: "everton",
    name: "Everton",
    shortName: "EVE",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Everton"
  },
  {
    id: "fulham",
    name: "Fulham",
    shortName: "FUL",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Fulham FC",
    sourceTeamAliases: ["Fulham"]
  },
  {
    id: "leeds-united",
    name: "Leeds United",
    shortName: "LEE",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Leeds United"
  },
  {
    id: "liverpool",
    name: "Liverpool",
    shortName: "LIV",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Liverpool"
  },
  {
    id: "manchester-city",
    name: "Manchester City",
    shortName: "MCI",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Manchester City"
  },
  {
    id: "manchester-united",
    name: "Manchester United",
    shortName: "MUN",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Man Utd",
    sourceTeamAliases: ["Manchester United"]
  },
  {
    id: "newcastle-united",
    name: "Newcastle United",
    shortName: "NEW",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Newcastle United"
  },
  {
    id: "nottingham-forest",
    name: "Nottingham Forest",
    shortName: "NFO",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Nottingham Forest"
  },
  {
    id: "sunderland",
    name: "Sunderland",
    shortName: "SUN",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Sunderland"
  },
  {
    id: "tottenham-hotspur",
    name: "Tottenham Hotspur",
    shortName: "TOT",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Tottenham Hotspur"
  },
  {
    id: "west-ham-united",
    name: "West Ham United",
    shortName: "WHU",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "West Ham United"
  },
  {
    id: "wolverhampton-wanderers",
    name: "Wolverhampton Wanderers",
    shortName: "WOL",
    country: "England",
    league: "Premier League",
    sourceLeagueId: 13,
    sourceTeam: "Wolverhampton Wanderers",
    sourceTeamAliases: ["Wolves"]
  }
] as const satisfies readonly Fc25ClubDefinition[];

export const FC25_FOOTSIM_CLUBS = FC25_CLUBS.filter((club) =>
  ["arsenal", "aston-villa", "liverpool", "manchester-city", "manchester-united"].includes(club.id)
);

export function clubsForUniverse(universe: Fc25ClubUniverse): readonly Fc25ClubDefinition[] {
  return universe === "pl20" ? FC25_CLUBS : FC25_FOOTSIM_CLUBS;
}

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
