import { AWAY_GOAL_Y, GOAL_CENTRE_X, HOME_GOAL_Y, PITCH_LENGTH } from "../../calibration/constants";
import { SUCCESS_PROBABILITIES } from "../../calibration/probabilities";
import { emitEvent } from "../../ticks/runTick";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import type { TeamId } from "../../types";
import { attackDirection } from "../../zones/pitchZones";
import { emitPossessionChange } from "../pressure";

export function performShot(state: MutableMatchState, shooter: MutablePlayer): void {
  const teamStats = state.stats[shooter.teamId];
  teamStats.shots.total += 1;

  const onTargetProbability =
    SUCCESS_PROBABILITIES.shotOnTargetByZone[state.possession.zone] *
    SUCCESS_PROBABILITIES.shotPressureModifier[state.possession.pressureLevel] *
    (shooter.baseInput.attributes.shooting / 100);

  const onTarget = state.rng.next() <= onTargetProbability;
  emitEvent(state, "shot", shooter.teamId, shooter.id, { onTarget });

  if (!onTarget) {
    teamStats.shots.off += 1;
    giveGoalKick(state, otherTeam(shooter.teamId), shooter.teamId);
    return;
  }

  teamStats.shots.on += 1;
  const keeper = goalkeeperFor(state, otherTeam(shooter.teamId));
  const saveProbability =
    SUCCESS_PROBABILITIES.saveBase * ((keeper?.baseInput.attributes.saving ?? 50) / 100);

  if (keeper && state.rng.next() <= saveProbability) {
    emitEvent(state, "save", keeper.teamId, keeper.id, { shooterId: shooter.id });
    givePossession(state, keeper);
    return;
  }

  teamStats.goals += 1;
  state.score[shooter.teamId] += 1;
  state.ball.position = [GOAL_CENTRE_X, shooter.teamId === "home" ? AWAY_GOAL_Y : HOME_GOAL_Y, 0];
  emitEvent(state, "goal", shooter.teamId, shooter.id, { fromZone: state.possession.zone });
  restartAfterGoal(state, otherTeam(shooter.teamId));
}

function giveGoalKick(state: MutableMatchState, keeperTeam: TeamId, from: TeamId): void {
  const keeper = goalkeeperFor(state, keeperTeam);
  if (!keeper) {
    return;
  }
  givePossession(state, keeper);
  emitPossessionChange(state, from, keeperTeam, keeper.id);
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

function restartAfterGoal(state: MutableMatchState, restartTeam: TeamId): void {
  const direction = attackDirection(restartTeam);
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
  receiver.position = [GOAL_CENTRE_X, PITCH_LENGTH / 2 - direction * 18];
  receiver.targetPosition = receiver.position;
  state.ball.carrierPlayerId = receiver.id;
  state.ball.position = [receiver.position[0], receiver.position[1], 0];
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
