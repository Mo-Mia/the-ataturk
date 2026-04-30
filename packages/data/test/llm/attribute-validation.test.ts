import { describe, expect, it } from "vitest";

import { validateAttributesAgainstPosition } from "../../src/llm/attribute-validation";
import type { PlayerAttributeValues } from "../../src/types";

const validSTierMidfielder: PlayerAttributeValues = {
  passing: 92,
  shooting: 90,
  tackling: 82,
  saving: 10,
  agility: 84,
  strength: 80,
  penalty_taking: 78,
  perception: 93,
  jumping: 75,
  control: 91
};

describe("attribute validation", () => {
  it("passes valid attributes", () => {
    expect(validateAttributesAgainstPosition(validSTierMidfielder, "CM", "S")).toEqual({
      ok: true
    });
  });

  it("fails a goalkeeper with too-low saving", () => {
    const result = validateAttributesAgainstPosition(
      {
        ...validSTierMidfielder,
        saving: 60,
        passing: 55,
        shooting: 20,
        tackling: 30,
        strength: 45,
        penalty_taking: 30,
        perception: 80,
        jumping: 80,
        control: 60
      },
      "GK",
      "A"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain("Goalkeepers must have saving of at least 70");
    }
  });

  it("allows goalkeeper-relevant perception, jumping, and agility above 75", () => {
    const result = validateAttributesAgainstPosition(
      {
        passing: 60,
        shooting: 20,
        tackling: 30,
        saving: 86,
        agility: 79,
        strength: 45,
        penalty_taking: 30,
        perception: 82,
        jumping: 82,
        control: 60
      },
      "GK",
      "A"
    );

    expect(result).toEqual({ ok: true });
  });

  it("fails an A-tier centre-back with too-low tackling", () => {
    const result = validateAttributesAgainstPosition(
      {
        ...validSTierMidfielder,
        tackling: 60,
        shooting: 55,
        passing: 78,
        strength: 86,
        jumping: 86,
        perception: 88,
        control: 74
      },
      "CB",
      "A"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain("CB A-tier tackling must be at least 65");
    }
  });

  it("fails an S-tier player without enough 90+ attributes", () => {
    const result = validateAttributesAgainstPosition(
      {
        ...validSTierMidfielder,
        passing: 89,
        shooting: 88,
        perception: 87,
        control: 86
      },
      "CM",
      "S"
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain("S-tier players need at least 3 attributes at 90+");
    }
  });

  it("returns all violations", () => {
    const result = validateAttributesAgainstPosition(
      {
        ...validSTierMidfielder,
        tackling: 50,
        saving: 40,
        jumping: 50,
        strength: 50,
        perception: 50
      },
      "CB",
      "A"
    );

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.reasons).toEqual(
        expect.arrayContaining([
          "Outfield players must have saving of 25 or lower",
          "CB A-tier tackling must be at least 65",
          "CB A-tier jumping must be at least 65",
          "CB A-tier strength must be at least 65",
          "CB A-tier perception must be at least 65"
        ])
      );
    }
  });
});
