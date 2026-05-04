import { GOAL_CELEBRATION_TICKS, GOAL_CENTRE_X } from "../../calibration/constants";
import {
  SET_PIECES,
  SHOT_PREFERRED_FOOT_PROBABILITY_BY_WEAK_FOOT_RATING,
  SHOT_WEAK_FOOT_MULTIPLIER_BY_RATING,
  SUCCESS_PROBABILITIES
} from "../../calibration/probabilities";
import { emitEvent } from "../../ticks/runTick";
import type { MutableMatchState, MutablePlayer } from "../../state/matchState";
import { otherTeam } from "../../state/matchState";
import { recordScoreStateEvent } from "../../state/scoreState";
import { staminaEffectMultiplier } from "../../state/stamina";
import type { SaveQuality, SaveResult, ShotFoot, ShotType, StarRating, TeamId } from "../../types";
import { attackingGoalY, zoneForPositionWithDirection } from "../../zones/pitchZones";
import { emitPossessionChange } from "../pressure";
import { awardCorner, awardGoalKick } from "../setPieces";
import { shotDistanceContextForDirection, type ShotDistanceContext } from "../shotDistance";

export interface ShotContext {
  source?: "chance_creation" | "set_piece";
  chanceSource?: string;
  setPieceContext?: Record<string, unknown>;
}

export function performShot(
  state: MutableMatchState,
  shooter: MutablePlayer,
  context: ShotContext = {}
): void {
  const teamStats = state.stats[shooter.teamId];
  teamStats.shots.total += 1;
  if (context.source === "set_piece") {
    state.setPieceStats[shooter.teamId].setPieceShots += 1;
  }
  const shotDistance = shotDistanceContextForDirection(
    state.attackDirection[shooter.teamId],
    shooter.position
  );
  const shotType = shotTypeFor(shooter, shotDistance.band, state.possession.pressureLevel);
  const shotFoot = shotFootFor(state, shooter, shotType);

  const onTargetProbability =
    SUCCESS_PROBABILITIES.shotOnTargetByZone[state.possession.zone] *
    SUCCESS_PROBABILITIES.shotPressureModifier[state.possession.pressureLevel] *
    (shooter.baseInput.attributes.shooting / 100) *
    shotDistance.onTarget *
    shotFoot.onTargetMultiplier *
    staminaEffectMultiplier(shooter);

  const onTarget = state.rng.next() <= onTargetProbability;
  emitEvent(state, "shot", shooter.teamId, shooter.id, {
    onTarget,
    shotType,
    fromZone: state.possession.zone,
    ...(shotFoot.foot ? { foot: shotFoot.foot } : {}),
    distancePitchUnits: Math.round(shotDistance.distanceToGoal),
    distanceToGoalMetres: Math.round(shotDistance.distanceToGoal / 10),
    distanceBand: shotDistance.band,
    pressure: state.possession.pressureLevel,
    ...(context.chanceSource ? { chanceSource: context.chanceSource } : {}),
    ...(context.setPieceContext ? { setPieceContext: context.setPieceContext } : {})
  });

  if (!onTarget) {
    if (
      state.dynamics.setPieces &&
      state.rng.next() <= SET_PIECES.shotDeflectionCornerByPressure[state.possession.pressureLevel]
    ) {
      teamStats.shots.blocked += 1;
      awardCorner(state, shooter.teamId, shooter.position, "deflected_shot", shooter.id);
      return;
    }
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
      shotDistance.save *
      shotFoot.saveProbabilityMultiplier
  );

  if (keeper) {
    const saveRoll = state.rng.next();
    if (saveRoll > saveProbability) {
      commitGoal(state, shooter, shotDistance, shotType, shotFoot.foot, context);
      return;
    }

    emitEvent(state, "save", keeper.teamId, keeper.id, {
      shooterId: shooter.id,
      quality: saveQualityFor(saveProbability - saveRoll),
      result: saveResultFor(saveProbability - saveRoll)
    });
    givePossession(state, keeper, shooter.teamId, shooter.id);
    return;
  }

  commitGoal(state, shooter, shotDistance, shotType, shotFoot.foot, context);
}

function commitGoal(
  state: MutableMatchState,
  shooter: MutablePlayer,
  shotDistance: ShotDistanceContext,
  shotType: ShotType,
  foot: ShotFoot | undefined,
  context: ShotContext = {}
): void {
  const teamStats = state.stats[shooter.teamId];
  teamStats.goals += 1;
  if (context.source === "set_piece") {
    state.setPieceStats[shooter.teamId].setPieceGoals += 1;
  }
  state.score[shooter.teamId] += 1;
  state.ball.position = [GOAL_CENTRE_X, attackingGoalY(state.attackDirection[shooter.teamId]), 0];
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
    shotType,
    ...(foot ? { foot } : {}),
    distancePitchUnits: Math.round(shotDistance.distanceToGoal),
    distanceToGoalMetres: Math.round(shotDistance.distanceToGoal / 10),
    distanceBand: shotDistance.band,
    pressure: state.possession.pressureLevel,
    ...(context.chanceSource ? { chanceSource: context.chanceSource } : {}),
    ...(context.setPieceContext ? { setPieceContext: context.setPieceContext } : {}),
    score: { ...state.score },
    restartTeam: otherTeam(shooter.teamId)
  });
  recordScoreStateEvent(state);
}

export function performPenaltyShot(
  state: MutableMatchState,
  taker: MutablePlayer,
  context: Record<string, unknown>
): void {
  const teamStats = state.stats[taker.teamId];
  teamStats.shots.total += 1;
  teamStats.shots.on += 1;
  state.setPieceStats[taker.teamId].setPieceShots += 1;

  const keeper = goalkeeperFor(state, otherTeam(taker.teamId));
  const takerQuality = taker.v2Input
    ? (taker.v2Input.attributes.penalties * 0.55 +
        taker.v2Input.attributes.composure * 0.3 +
        taker.v2Input.attributes.shotPower * 0.15) /
      100
    : (taker.baseInput.attributes.penaltyTaking * 0.65 +
        taker.baseInput.attributes.perception * 0.35) /
      100;
  const keeperQuality = keeper?.v2Input?.gkAttributes
    ? (keeper.v2Input.gkAttributes.gkReflexes * 0.55 +
        keeper.v2Input.gkAttributes.gkPositioning * 0.45) /
      100
    : (keeper?.baseInput.attributes.saving ?? 55) / 100;
  const conversionProbability = Math.max(
    0.58,
    Math.min(
      0.9,
      SET_PIECES.penaltyGoalBase + (takerQuality - 0.75) * 0.18 - (keeperQuality - 0.75) * 0.1
    )
  );
  const scored = state.rng.next() <= conversionProbability;

  emitEvent(state, "shot", taker.teamId, taker.id, {
    onTarget: true,
    shotType: "placed",
    foot: "preferred",
    distancePitchUnits: 120,
    distanceToGoalMetres: 12,
    distanceBand: "close",
    pressure: "low",
    setPieceContext: { ...context, type: "penalty" }
  });

  if (scored) {
    commitGoal(
      state,
      taker,
      { distanceToGoal: 120, band: "close", actionWeight: 1, onTarget: 1, save: 1 },
      "placed",
      "preferred",
      { source: "set_piece", setPieceContext: { ...context, type: "penalty" } }
    );
    return;
  }

  if (keeper) {
    emitEvent(state, "save", keeper.teamId, keeper.id, {
      shooterId: taker.id,
      quality: "good",
      result: "parried_safe",
      setPieceContext: { ...context, type: "penalty" }
    });
    givePossession(state, keeper, taker.teamId, taker.id);
  }
}

function givePossession(
  state: MutableMatchState,
  receiver: MutablePlayer,
  previousTeam: TeamId,
  previousPossessor: string
): void {
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
  emitPossessionChange(state, previousTeam, receiver.teamId, receiver.id, {
    cause: "goalkeeper_save",
    previousPossessor,
    zone: zoneForState(state, receiver.teamId, receiver.position)
  });
}

export function restartAfterGoal(
  state: MutableMatchState,
  restartTeam: TeamId,
  previousPossessor?: string
): void {
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
  emitPossessionChange(state, otherTeam(restartTeam), restartTeam, receiver.id, {
    cause: "kickoff_after_goal",
    ...(previousPossessor ? { previousPossessor } : {}),
    zone: zoneForState(state, restartTeam, receiver.position)
  });
}

function zoneForState(
  state: MutableMatchState,
  teamId: MutablePlayer["teamId"],
  position: MutablePlayer["position"]
) {
  return zoneForPositionWithDirection(position, state.attackDirection[teamId]);
}

function goalkeeperFor(state: MutableMatchState, teamId: TeamId): MutablePlayer | null {
  return (
    state.players.find(
      (player) => player.teamId === teamId && player.baseInput.position === "GK" && player.onPitch
    ) ?? null
  );
}

function shotTypeFor(
  shooter: MutablePlayer,
  band: string,
  pressure: "low" | "medium" | "high"
): ShotType {
  if (
    (band === "close" || band === "box") &&
    shooter.baseInput.attributes.jumping > shooter.baseInput.attributes.shooting + 6
  ) {
    return "header";
  }
  if (band === "far" || band === "speculative") {
    return "long_range";
  }
  if (pressure === "high") {
    return shooter.baseInput.attributes.strength >= shooter.baseInput.attributes.control
      ? "power"
      : "first_time";
  }
  if (shooter.baseInput.attributes.control > shooter.baseInput.attributes.shooting + 5) {
    return "volley";
  }
  return shooter.baseInput.attributes.perception >= shooter.baseInput.attributes.strength
    ? "placed"
    : "power";
}

interface ShotFootContext {
  foot?: ShotFoot;
  onTargetMultiplier: number;
  saveProbabilityMultiplier: number;
}

function shotFootFor(
  state: MutableMatchState,
  shooter: MutablePlayer,
  shotType: ShotType
): ShotFootContext {
  if (shotType === "header") {
    return { onTargetMultiplier: 1, saveProbabilityMultiplier: 1 };
  }

  if (!shooter.v2Input) {
    return {
      foot: legacyShotFootFor(shooter),
      onTargetMultiplier: 1,
      saveProbabilityMultiplier: 1
    };
  }

  if (shooter.v2Input.preferredFoot === "either") {
    return { foot: "preferred", onTargetMultiplier: 1, saveProbabilityMultiplier: 1 };
  }

  const rating = shooter.v2Input.weakFootRating;
  const preferredProbability = SHOT_PREFERRED_FOOT_PROBABILITY_BY_WEAK_FOOT_RATING[rating];
  const foot: ShotFoot = state.rng.next() <= preferredProbability ? "preferred" : "weak";

  if (foot === "preferred") {
    return { foot, onTargetMultiplier: 1, saveProbabilityMultiplier: 1 };
  }

  const multiplier = weakFootMultiplier(rating);
  return {
    foot,
    onTargetMultiplier: multiplier,
    saveProbabilityMultiplier: 1 / multiplier
  };
}

function weakFootMultiplier(rating: StarRating): number {
  return SHOT_WEAK_FOOT_MULTIPLIER_BY_RATING[rating];
}

function legacyShotFootFor(shooter: MutablePlayer): ShotFoot {
  const checksum = [...shooter.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  return checksum % 5 === 0 ? "weak" : "preferred";
}

function saveQualityFor(margin: number): SaveQuality {
  if (margin >= 0.22) {
    return "routine";
  }
  if (margin >= 0.07) {
    return "good";
  }
  return "spectacular";
}

function saveResultFor(margin: number): SaveResult {
  if (margin >= 0.22) {
    return "caught";
  }
  return margin >= 0.07 ? "parried_safe" : "parried_dangerous";
}
