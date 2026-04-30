import {
  getClub,
  getPlayer,
  getPlayerAttributes,
  type Player as DataPlayer,
  type PlayerAttributes
} from "@the-ataturk/data";
import { initiateGame, startSecondHalf, type MatchDetails, type Player, type Pitch, type PlayerInput, type PlayerStats, type TeamInput } from "@the-ataturk/engine";
import {
  LIVERPOOL_FORMATION,
  MILAN_FORMATION,
  applyFormation,
  type FormationName
} from "@the-ataturk/tactics";
import { withEngineConsoleMuted } from "@the-ataturk/engine/internal/silence";

export { LIVERPOOL_FORMATION, MILAN_FORMATION };

export const LIVERPOOL_SECOND_HALF_XI = [
  "jerzy-dudek",
  "steve-finnan",
  "jamie-carragher",
  "sami-hyypia",
  "djimi-traore",
  "steven-gerrard",
  "xabi-alonso",
  "john-arne-riise",
  "vladimir-smicer",
  "luis-garcia",
  "milan-baros"
] as const;

export const MILAN_SECOND_HALF_XI = [
  "dida",
  "cafu",
  "jaap-stam",
  "alessandro-nesta",
  "paolo-maldini",
  "gennaro-gattuso",
  "andrea-pirlo",
  "clarence-seedorf",
  "kaka",
  "hernan-crespo",
  "andriy-shevchenko"
] as const;

const PITCH: Pitch = {
  pitchWidth: 680,
  pitchHeight: 1050,
  goalWidth: 90
};

const LIVERPOOL_ENGINE_POSITIONS = [
  "GK",
  "RB",
  "CB",
  "CB",
  "LB",
  "RM",
  "CM",
  "LM",
  "CM",
  "ST",
  "ST"
] as const;

const MILAN_ENGINE_POSITIONS = [
  "GK",
  "RB",
  "CB",
  "CB",
  "LB",
  "DM",
  "DM",
  "CM",
  "AM",
  "ST",
  "ST"
] as const;

interface HistoricalFirstHalf {
  score: {
    home: number;
    away: number;
  };
  possession: {
    home: number;
    away: number;
  };
  goals: Array<{
    minute: number;
    team: "home" | "away";
    playerId: string;
    playerName: string;
    assistedBy?: string;
    detail: string;
  }>;
  notes: string[];
}

export async function buildHalfTimeMatchState(
  homeClubId: string,
  awayClubId: string,
  datasetVersion: string
): Promise<MatchDetails> {
  const homeTeam = buildTeamInput(
    homeClubId,
    datasetVersion,
    LIVERPOOL_SECOND_HALF_XI,
    LIVERPOOL_ENGINE_POSITIONS,
    "4-4-2"
  );
  const awayTeam = buildTeamInput(
    awayClubId,
    datasetVersion,
    MILAN_SECOND_HALF_XI,
    MILAN_ENGINE_POSITIONS,
    "4-3-1-2"
  );

  let matchDetails = await withEngineConsoleMuted(() => initiateGame(homeTeam, awayTeam, PITCH));
  matchDetails = await withEngineConsoleMuted(() => startSecondHalf(matchDetails));

  normaliseTeamIds(matchDetails, homeClubId, awayClubId);
  setSecondHalfKickoff(matchDetails);
  applyHistoricalFirstHalf(matchDetails);

  matchDetails.matchID = `final-2005:${homeClubId}-v-${awayClubId}:${datasetVersion}:second-half`;
  matchDetails.iterationLog = ["Second half ready: Liverpool kick off at 45:00."];
  matchDetails.half = 2;

  return matchDetails;
}

function buildTeamInput(
  clubId: string,
  datasetVersion: string,
  playerIds: readonly string[],
  positions: readonly string[],
  formation: FormationName
): TeamInput {
  const club = getClub(clubId);
  if (!club) {
    throw new Error(`Club '${clubId}' does not exist`);
  }

  const team: TeamInput = {
    name: club.name,
    rating: 0,
    manager: club.manager_real,
    players: playerIds.map((playerId, index) => {
      const player = getPlayer(playerId);
      if (!player) {
        throw new Error(`Player '${playerId}' does not exist`);
      }

      if (player.club_id !== clubId) {
        throw new Error(`Player '${playerId}' does not belong to '${clubId}'`);
      }

      const attributes = getPlayerAttributes(player.id, datasetVersion);
      if (!attributes) {
        throw new Error(`Attributes for player '${player.id}' in '${datasetVersion}' do not exist`);
      }

      if (!hasNonZeroAttributes(attributes)) {
        throw new Error(`Attributes for player '${player.id}' in '${datasetVersion}' are all zero`);
      }

      return toEnginePlayerInput(player, attributes, positions[index]!);
    })
  };

  const formedTeam = applyFormation(team, formation);
  const totalRating = formedTeam.players.reduce((sum, player) => sum + Number(player.rating), 0);

  return {
    ...formedTeam,
    rating: Math.round(totalRating / formedTeam.players.length)
  };
}

function toEnginePlayerInput(
  player: DataPlayer,
  attributes: PlayerAttributes,
  enginePosition: string
): PlayerInput {
  return {
    name: player.name,
    position: enginePosition,
    rating: averageAttributeRating(attributes),
    skill: {
      passing: attributes.passing,
      shooting: attributes.shooting,
      tackling: attributes.tackling,
      saving: attributes.saving,
      agility: attributes.agility,
      strength: attributes.strength,
      penalty_taking: attributes.penalty_taking,
      perception: attributes.perception,
      jumping: attributes.jumping,
      control: attributes.control
    },
    currentPOS: [0, 0],
    fitness: 100,
    height: player.height_cm ?? 180,
    injured: player.injury_status !== "fit",
    dbPlayerId: player.id,
    shortName: player.short_name
  };
}

function averageAttributeRating(attributes: PlayerAttributes): number {
  const values = [
    attributes.passing,
    attributes.shooting,
    attributes.tackling,
    attributes.saving,
    attributes.agility,
    attributes.strength,
    attributes.penalty_taking,
    attributes.perception,
    attributes.jumping,
    attributes.control
  ];

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function hasNonZeroAttributes(attributes: PlayerAttributes): boolean {
  return [
    attributes.passing,
    attributes.shooting,
    attributes.tackling,
    attributes.saving,
    attributes.agility,
    attributes.strength,
    attributes.penalty_taking,
    attributes.perception,
    attributes.jumping,
    attributes.control
  ].some((value) => value > 0);
}

function normaliseTeamIds(matchDetails: MatchDetails, homeClubId: string, awayClubId: string): void {
  matchDetails.kickOffTeam.teamID = homeClubId;
  matchDetails.secondTeam.teamID = awayClubId;

  normalisePlayerIds(matchDetails.kickOffTeam.players);
  normalisePlayerIds(matchDetails.secondTeam.players);
}

function normalisePlayerIds(players: Player[]): void {
  for (const player of players) {
    const dbPlayerId = player.dbPlayerId;
    if (typeof dbPlayerId !== "string") {
      throw new Error(`Player '${player.name}' is missing a database player id`);
    }

    player.playerID = dbPlayerId;
    player.fitness = 92;
    player.originPOS = [...player.originPOS];
    player.currentPOS = [...player.originPOS];
    player.intentPOS = [...player.originPOS];
    player.hasBall = false;
    player.action = "none";
    player.offside = false;
  }
}

function setSecondHalfKickoff(matchDetails: MatchDetails): void {
  const kickoffPlayer = matchDetails.kickOffTeam.players[9];
  const waitingPlayer = matchDetails.kickOffTeam.players[10];

  if (!kickoffPlayer || !waitingPlayer) {
    throw new Error("Liverpool kickoff requires two forwards");
  }

  for (const player of [...matchDetails.kickOffTeam.players, ...matchDetails.secondTeam.players]) {
    player.hasBall = false;
    player.currentPOS = [...player.originPOS];
    player.intentPOS = [...player.originPOS];
  }

  kickoffPlayer.currentPOS = [340, 525];
  kickoffPlayer.intentPOS = [340, 525];
  kickoffPlayer.hasBall = true;
  waitingPlayer.currentPOS = [360, 525];
  waitingPlayer.intentPOS = [360, 525];

  matchDetails.ball = {
    position: [340, 525, 0],
    withPlayer: true,
    Player: kickoffPlayer.playerID,
    withTeam: matchDetails.kickOffTeam.teamID,
    direction: "south",
    ballOverIterations: [],
    lastTouch: {
      playerName: kickoffPlayer.name,
      playerID: kickoffPlayer.playerID,
      teamID: matchDetails.kickOffTeam.teamID,
      bodyPart: "",
      deflection: false,
      iterations: null
    }
  };
  matchDetails.kickOffTeam.intent = "attack";
  matchDetails.secondTeam.intent = "defend";
}

function applyHistoricalFirstHalf(matchDetails: MatchDetails): void {
  matchDetails.kickOffTeamStatistics = {
    goals: 0,
    shots: {
      total: 1,
      on: 0,
      off: 1
    },
    corners: 3,
    freekicks: 5,
    penalties: 0,
    fouls: 9
  };
  matchDetails.secondTeamStatistics = {
    goals: 3,
    shots: {
      total: 8,
      on: 5,
      off: 3
    },
    corners: 3,
    freekicks: 9,
    penalties: 0,
    fouls: 5
  };

  setPlayerGoals(matchDetails.secondTeam.players, "paolo-maldini", 1);
  setPlayerGoals(matchDetails.secondTeam.players, "hernan-crespo", 2);
  setPlayerYellowCards(matchDetails.kickOffTeam.players, "jamie-carragher", 1);
  setPlayerYellowCards(matchDetails.secondTeam.players, "gennaro-gattuso", 1);

  matchDetails.historicalFirstHalf = {
    score: {
      home: 0,
      away: 3
    },
    possession: {
      home: 40,
      away: 60
    },
    goals: [
      {
        minute: 1,
        team: "away",
        playerId: "paolo-maldini",
        playerName: "Paolo Maldini",
        assistedBy: "andrea-pirlo",
        detail: "Pirlo free kick after a foul just outside the area."
      },
      {
        minute: 39,
        team: "away",
        playerId: "hernan-crespo",
        playerName: "Hernán Crespo",
        assistedBy: "kaka",
        detail: "Kaká split Liverpool open for Crespo to finish."
      },
      {
        minute: 44,
        team: "away",
        playerId: "hernan-crespo",
        playerName: "Hernán Crespo",
        assistedBy: "kaka",
        detail: "Kaká released Crespo again before half-time."
      }
    ],
    notes: [
      "Gameplay-visible first-half state is curated; engine-internal micro-state is approximated.",
      "Liverpool restart the second half at the centre spot."
    ]
  } satisfies HistoricalFirstHalf;
}

function setPlayerGoals(players: Player[], playerId: string, goals: number): void {
  const player = findPlayer(players, playerId);
  player.stats.goals = goals;
}

function setPlayerYellowCards(players: Player[], playerId: string, yellowCards: number): void {
  const player = findPlayer(players, playerId);
  player.stats.cards.yellow = yellowCards;
}

function findPlayer(players: Player[], playerId: string): Player {
  const player = players.find((candidate) => candidate.playerID === playerId);
  if (!player) {
    throw new Error(`Player '${playerId}' is missing from the match state`);
  }

  return player;
}
