import { PITCH_LENGTH, PITCH_WIDTH } from "../calibration/constants";
import type { MatchConfig, TeamStatistics } from "../types";
import { createSeededRng } from "../utils/rng";
import { positionTeam } from "../utils/formations";
import { emptyTeamStatistics, type MutableMatchState, type MutablePlayer } from "./matchState";

export function buildInitState(config: MatchConfig): MutableMatchState {
  validateConfig(config);

  const isSecondHalf = config.duration === "second_half";
  const players: MutablePlayer[] = [
    ...config.homeTeam.players.map((player) => mutablePlayer(player, "home")),
    ...config.awayTeam.players.map((player) => mutablePlayer(player, "away"))
  ];

  positionTeam(
    players.filter((player) => player.teamId === "home"),
    config.homeTeam.tactics.formation
  );
  positionTeam(
    players.filter((player) => player.teamId === "away"),
    config.awayTeam.tactics.formation
  );

  const state: MutableMatchState = {
    iteration: 0,
    matchClock: { half: isSecondHalf ? 2 : 1, minute: isSecondHalf ? 45 : 0, seconds: 0 },
    duration: config.duration,
    seed: config.seed,
    rng: createSeededRng(config.seed),
    homeTeam: config.homeTeam,
    awayTeam: config.awayTeam,
    players,
    ball: {
      position: [PITCH_WIDTH / 2, PITCH_LENGTH / 2, 0],
      targetPosition: null,
      inFlight: false,
      carrierPlayerId: null,
      targetCarrierPlayerId: null
    },
    score: config.preMatchScore ? { ...config.preMatchScore } : { home: 0, away: 0 },
    stats: {
      home: cloneStats(config.preMatchStats?.home, config.preMatchScore?.home ?? 0),
      away: cloneStats(config.preMatchStats?.away, config.preMatchScore?.away ?? 0)
    },
    possession: { teamId: "home", zone: "mid", pressureLevel: "low" },
    possessionTicks: { home: 0, away: 0 },
    eventsThisTick: [],
    allEvents: []
  };

  giveKickOffToHome(state);
  return state;
}

function mutablePlayer(
  player: import("../types").PlayerInput,
  teamId: "home" | "away"
): MutablePlayer {
  return {
    id: player.id,
    teamId,
    position: [0, 0],
    targetPosition: [0, 0],
    anchorPosition: [0, 0],
    hasBall: false,
    onPitch: true,
    yellowCards: 0,
    redCard: false,
    baseInput: player
  };
}

function giveKickOffToHome(state: MutableMatchState): void {
  const striker =
    state.players.find(
      (player) => player.teamId === "home" && player.baseInput.position === "ST"
    ) ??
    state.players.find(
      (player) => player.teamId === "home" && player.baseInput.position !== "GK"
    ) ??
    state.players.find((player) => player.teamId === "home");

  if (!striker) {
    return;
  }

  striker.position = [PITCH_WIDTH / 2, PITCH_LENGTH / 2];
  striker.targetPosition = [PITCH_WIDTH / 2, PITCH_LENGTH / 2];
  striker.hasBall = true;
  state.ball.carrierPlayerId = striker.id;
  state.ball.position = [PITCH_WIDTH / 2, PITCH_LENGTH / 2, 0];
}

function cloneStats(stats: TeamStatistics | undefined, scoreGoals: number): TeamStatistics {
  const cloned = stats ? structuredClone(stats) : emptyTeamStatistics();
  cloned.goals = scoreGoals;
  return cloned;
}

function validateConfig(config: MatchConfig): void {
  if (config.homeTeam.players.length !== 11 || config.awayTeam.players.length !== 11) {
    throw new Error("Match engine requires exactly 11 players per team");
  }
}
