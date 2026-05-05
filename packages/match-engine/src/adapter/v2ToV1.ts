import type { PlayerAttributes, PlayerInput, PlayerInputV2 } from "../types";

/**
 * Collapse FC25-style v2 attributes into the v1 match-engine schema.
 *
 * The bridge keeps the calibrated v1 probability model stable while allowing
 * richer v2 inputs to enter the engine. Repeated source attributes are
 * deliberate weighting choices: for example, vision contributes to both
 * passing and perception because it affects both distribution and reading play.
 *
 * @param player FC25-style v2 player input.
 * @returns Equivalent v1 player input for the calibrated engine core.
 * @throws If a goalkeeper is missing goalkeeper-specific attributes.
 */
export function adaptV2ToV1(player: PlayerInputV2): PlayerInput {
  if (player.position === "GK" && !player.gkAttributes) {
    throw new Error(`Goalkeeper ${player.id} requires gkAttributes in v2 input`);
  }

  return {
    id: player.id,
    name: player.name,
    shortName: player.shortName,
    ...(player.squadNumber === undefined ? {} : { squadNumber: player.squadNumber }),
    position: player.position,
    attributes: adaptAttributes(player),
    ...(player.overrides ? { overrides: player.overrides } : {})
  };
}

/**
 * Identify whether a player input uses the FC25-style v2 attribute shape.
 *
 * @param player Player input in either supported public engine format.
 * @returns True when the input carries v2 footedness and skill metadata.
 */
export function isPlayerInputV2(player: PlayerInput | PlayerInputV2): player is PlayerInputV2 {
  return "preferredFoot" in player && "weakFootRating" in player && "skillMovesRating" in player;
}

function adaptAttributes(player: PlayerInputV2): PlayerAttributes {
  const attributes = player.attributes;
  const gkAttributes = player.gkAttributes;

  return {
    /** Short and long passing plus vision form the v1 distribution score. */
    passing: average(attributes.shortPassing, attributes.longPassing, attributes.vision),
    /** Finishing, shot power, long shots and attacking positioning form v1 shooting. */
    shooting: average(
      attributes.finishing,
      attributes.shotPower,
      attributes.longShots,
      attributes.positioning
    ),
    /** Standing/sliding tackle plus defensive awareness form v1 tackling. */
    tackling: average(
      attributes.standingTackle,
      attributes.slidingTackle,
      attributes.defensiveAwareness
    ),
    /** v1 saving is a single goalkeeper quality value; outfielders keep the v1 default. */
    saving: gkAttributes
      ? average(
          gkAttributes.gkDiving,
          gkAttributes.gkReflexes,
          gkAttributes.gkPositioning,
          gkAttributes.gkHandling
        )
      : 10,
    /** v1 agility drives movement speed, so both acceleration and sprint speed are included. */
    agility: average(
      attributes.agility,
      attributes.acceleration,
      attributes.sprintSpeed,
      attributes.balance
    ),
    /** v1 strength reflects physical contesting plus aerial power. */
    strength: average(attributes.strength, attributes.jumping),
    /** FC25 penalties maps directly to v1 penalty taking. */
    penaltyTaking: attributes.penalties,
    /** Vision, reactions and composure form the v1 read-of-play score. */
    perception: average(attributes.vision, attributes.reactions, attributes.composure),
    /** Jumping remains available directly because v1 already has a jumping field. */
    jumping: attributes.jumping,
    /** Ball control, dribbling and composure form the v1 close-control score. */
    control: average(attributes.ballControl, attributes.dribbling, attributes.composure)
  };
}

function average(...values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
