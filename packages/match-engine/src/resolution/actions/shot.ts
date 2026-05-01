import {
  AWAY_GOAL_Y,
  GOAL_CELEBRATION_TICKS,
  GOAL_CENTRE_X,
  HOME_GOAL_Y
} from "../../calibration/constants";
import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { emitEvent } from "../../ticks/runTick";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import type { TeamId } from "../../types";
import { awardGoalKick } from "../setPieces";
import { shotDistanceContext } from "../shotDistance";

export function performShot(state: MutableMatchState, shooter: MutablePlayer): void {
  const teamStats = state.stats[shooter.teamId];
  teamStats.shots.total += 1;
  const shotDistance = shotDistanceContext(shooter.teamId, shooter.position);

  const onTargetProbability =
    SUCCESS_PROBABILITIES.shotOnTargetByZone[state.possession.zone] *
    SUCCESS_PROBABILITIES.shotPressureModifier[state.possession.pressureLevel] *
    (shooter.baseInput.attributes.shooting / 100) *
    shotDistance.onTarget;

  const onTarget = state.rng.next() <= onTargetProbability;
  emitEvent(state, "shot", shooter.teamId, shooter.id, {
    onTarget,
    distanceToGoal: Math.round(shotDistance.distanceToGoal),
    distanceToGoalMetres: Math.round(shotDistance.distanceToGoal / 10),
    distanceBand: shotDistance.band
  });

  if (!onTarget) {
    teamStats.shots.off += 1;
    awardGoalKick(state, otherTeam(shooter.teamId), shooter.teamId, shooter.id);
    return;
  }

  teamStats.shots.on += 1;
  const keeper = goalkeeperFor(state, otherTeam(shooter.teamId));
  const saveProbability = Math.min(
    0.95,
    SUCCESS_PROBABILITIES.saveBase *
      ((keeper?.baseInput.attributes.saving ?? 50) / 100) *
      shotDistance.save
  );

  if (keeper && state.rng.next() <= saveProbability) {
    emitEvent(state, "save", keeper.teamId, keeper.id, { shooterId: shooter.id });
    givePossession(state, keeper);
    return;
  }

  teamStats.goals += 1;
  state.score[shooter.teamId] += 1;
  state.ball.position = [GOAL_CENTRE_X, shooter.teamId === "home" ? AWAY_GOAL_Y : HOME_GOAL_Y, 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.ball.carrierPlayerId = null;
  state.players.forEach((player) => {
    player.hasBall = false;
  });
  state.possession.teamId = null;
  state.pendingGoal = {
    scoringTeam: shooter.teamId,
    restartTeam: otherTeam(shooter.teamId),
    scorerPlayerId: shooter.id,
    score: { ...state.score },
    ticksUntilKickoff: GOAL_CELEBRATION_TICKS
  };
  emitEvent(state, "goal_scored", shooter.teamId, shooter.id, {
    fromZone: state.possession.zone,
    distanceToGoal: Math.round(shotDistance.distanceToGoal),
    distanceToGoalMetres: Math.round(shotDistance.distanceToGoal / 10),
    distanceBand: shotDistance.band,
    score: { ...state.score },
    restartTeam: otherTeam(shooter.teamId)
  });
}

function givePossession(state: MutableMatchState, receiver: MutablePlayer): void {
  state.players.forEach((player) => {
    player.hasBall = player.id === receiver.id;
  });
  receiver.hasBall = true;
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.ball.carrierPlayerId = receiver.id;
  state.ball.position = [receiver.position[0], receiver.position[1], 0];
  state.possession.teamId = receiver.teamId;
}

export function restartAfterGoal(state: MutableMatchState, restartTeam: TeamId): void {
  const receiver =
    state.players.find(
      (player) =>
        player.teamId === restartTeam && player.baseInput.position === "ST" && player.onPitch
    ) ?? state.players.find((player) => player.teamId === restartTeam && player.onPitch);
  if (!receiver) {
    return;
  }

  state.players.forEach((player) => {
    player.hasBall = player.id === receiver.id;
  });
  state.ball.carrierPlayerId = receiver.id;
  state.ball.position = [receiver.position[0], receiver.position[1], 0];
  state.ball.inFlight = false;
  state.ball.targetPosition = null;
  state.ball.targetCarrierPlayerId = null;
  state.possession.teamId = restartTeam;
  emitEvent(state, "kick_off", restartTeam, receiver.id, { afterGoal: true });
}

function goalkeeperFor(state: MutableMatchState, teamId: TeamId): MutablePlayer | null {
  return (
    state.players.find(
      (player) => player.teamId === teamId && player.baseInput.position === "GK" && player.onPitch
    ) ?? null
  );
}
