import {
  PLAYER_ATTRIBUTE_NAMES,
  type PlayerAttributeName,
  type PlayerAttributeValues,
  type PlayerProfileTier,
  type Position
} from "../types";

export type ValidationResult = { ok: true } | { ok: false; reasons: string[] };

type AttributeFloor = Partial<Record<PlayerAttributeName, number>>;

type OutfieldPosition = Exclude<Position, "GK">;

const A_TIER_POSITION_FLOORS = {
  CB: { tackling: 65, jumping: 65, strength: 65, perception: 65 },
  LB: { tackling: 60, agility: 60, perception: 60 },
  RB: { tackling: 60, agility: 60, perception: 60 },
  DM: { tackling: 70, perception: 70, passing: 70 },
  CM: { passing: 70, perception: 70, control: 70 },
  AM: { passing: 75, control: 75, perception: 75, shooting: 75 },
  LW: { agility: 70, control: 70, perception: 70 },
  RW: { agility: 70, control: 70, perception: 70 },
  ST: { shooting: 75, control: 75, perception: 75 }
} satisfies Record<OutfieldPosition, AttributeFloor>;

const HEADLINE_REQUIREMENTS: Partial<
  Record<
    PlayerProfileTier,
    { eliteThreshold: number; eliteCount: number; strongThreshold: number; strongCount: number }
  >
> = {
  S: { eliteThreshold: 90, eliteCount: 3, strongThreshold: 80, strongCount: 6 },
  A: { eliteThreshold: 85, eliteCount: 2, strongThreshold: 75, strongCount: 5 },
  B: { eliteThreshold: 82, eliteCount: 1, strongThreshold: 70, strongCount: 4 }
};

export function validateAttributesAgainstPosition(
  attrs: PlayerAttributeValues,
  position: Position,
  tier: PlayerProfileTier
): ValidationResult {
  const reasons: string[] = [];

  if (position === "GK") {
    validateGoalkeeper(attrs, tier, reasons);
  } else {
    validateOutfield(attrs, position, tier, reasons);
    validateHeadlineCounts(attrs, tier, reasons);
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

function validateOutfield(
  attrs: PlayerAttributeValues,
  position: Exclude<Position, "GK">,
  tier: PlayerProfileTier,
  reasons: string[]
): void {
  if (attrs.saving > 25) {
    reasons.push("Outfield players must have saving of 25 or lower");
  }

  if (tier !== "S" && tier !== "A") {
    return;
  }

  const floors = A_TIER_POSITION_FLOORS[position];

  for (const [attributeName, floor] of Object.entries(floors)) {
    const typedName = attributeName as PlayerAttributeName;
    if (attrs[typedName] < floor) {
      reasons.push(`${position} ${tier}-tier ${typedName} must be at least ${floor}`);
    }
  }
}

function validateGoalkeeper(
  attrs: PlayerAttributeValues,
  tier: PlayerProfileTier,
  reasons: string[]
): void {
  if (attrs.saving < 70) {
    reasons.push("Goalkeepers must have saving of at least 70");
  }

  for (const attributeName of PLAYER_ATTRIBUTE_NAMES) {
    if (attributeName === "saving") {
      continue;
    }

    if (attrs[attributeName] > 75) {
      reasons.push(`Goalkeeper ${attributeName} must be 75 or lower`);
    }
  }

  if (tier === "S") {
    validateRange(attrs.saving, 92, 96, "S-tier goalkeeper saving", reasons);
    validateFloor(attrs.perception, 85, "S-tier goalkeeper perception", reasons);
    validateFloor(attrs.jumping, 85, "S-tier goalkeeper jumping", reasons);
  }

  if (tier === "A") {
    validateRange(attrs.saving, 84, 90, "A-tier goalkeeper saving", reasons);
    validateFloor(attrs.perception, 78, "A-tier goalkeeper perception", reasons);
    validateFloor(attrs.jumping, 78, "A-tier goalkeeper jumping", reasons);
  }

  if (tier === "B") {
    validateRange(attrs.saving, 75, 82, "B-tier goalkeeper saving", reasons);
    validateFloor(attrs.perception, 72, "B-tier goalkeeper perception", reasons);
    validateFloor(attrs.jumping, 72, "B-tier goalkeeper jumping", reasons);
  }
}

function validateHeadlineCounts(
  attrs: PlayerAttributeValues,
  tier: PlayerProfileTier,
  reasons: string[]
): void {
  const requirement = HEADLINE_REQUIREMENTS[tier];

  if (!requirement) {
    return;
  }

  const values = PLAYER_ATTRIBUTE_NAMES.map((attributeName) => attrs[attributeName]);
  const eliteCount = values.filter((value) => value >= requirement.eliteThreshold).length;
  const strongCount = values.filter((value) => value >= requirement.strongThreshold).length;

  if (eliteCount < requirement.eliteCount) {
    reasons.push(
      `${tier}-tier players need at least ${requirement.eliteCount} attributes at ${requirement.eliteThreshold}+`
    );
  }

  if (strongCount < requirement.strongCount) {
    reasons.push(
      `${tier}-tier players need at least ${requirement.strongCount} attributes at ${requirement.strongThreshold}+`
    );
  }
}

function validateFloor(
  value: number,
  floor: number,
  label: string,
  reasons: string[]
): void {
  if (value < floor) {
    reasons.push(`${label} must be at least ${floor}`);
  }
}

function validateRange(
  value: number,
  min: number,
  max: number,
  label: string,
  reasons: string[]
): void {
  if (value < min || value > max) {
    reasons.push(`${label} must be between ${min} and ${max}`);
  }
}
