import { describe, expect, it } from "vitest";

import { adaptV2ToV1 } from "../../src";
import { createTestPlayerV2 } from "../helpers";

describe("adaptV2ToV1", () => {
  it("maps v2 outfield attributes to the v1 bridge schema", () => {
    const player = createTestPlayerV2("p1", "Player One", "P1", "CM", 8, 70);
    player.attributes.shortPassing = 82;
    player.attributes.longPassing = 76;
    player.attributes.vision = 88;
    player.attributes.finishing = 70;
    player.attributes.shotPower = 80;
    player.attributes.longShots = 74;
    player.attributes.positioning = 78;
    player.attributes.standingTackle = 62;
    player.attributes.slidingTackle = 58;
    player.attributes.defensiveAwareness = 66;
    player.attributes.agility = 72;
    player.attributes.acceleration = 84;
    player.attributes.sprintSpeed = 80;
    player.attributes.balance = 76;
    player.attributes.strength = 68;
    player.attributes.jumping = 74;
    player.attributes.penalties = 81;
    player.attributes.reactions = 79;
    player.attributes.composure = 83;
    player.attributes.ballControl = 85;
    player.attributes.dribbling = 87;
    player.preferredFoot = "left";

    const adapted = adaptV2ToV1(player);

    expect(adapted).toMatchObject({
      id: "p1",
      shortName: "P1",
      squadNumber: 8,
      position: "CM"
    });
    expect(adapted.attributes.passing).toBe((82 + 76 + 88) / 3);
    expect(adapted.attributes.shooting).toBe((70 + 80 + 74 + 78) / 4);
    expect(adapted.attributes.tackling).toBe((62 + 58 + 66) / 3);
    expect(adapted.attributes.saving).toBe(10);
    expect(adapted.attributes.agility).toBe((72 + 84 + 80 + 76) / 4);
    expect(adapted.attributes.strength).toBe((68 + 74) / 2);
    expect(adapted.attributes.penaltyTaking).toBe(81);
    expect(adapted.attributes.perception).toBe((88 + 79 + 83) / 3);
    expect(adapted.attributes.jumping).toBe(74);
    expect(adapted.attributes.control).toBe((85 + 87 + 83) / 3);
    expect(player.preferredFoot).toBe("left");
  });

  it("maps goalkeeper attributes to v1 saving and preserves kicking only as metadata", () => {
    const goalkeeper = createTestPlayerV2("gk1", "Keeper", "GK1", "GK", 1, 75);
    goalkeeper.gkAttributes = {
      gkDiving: 84,
      gkHandling: 78,
      gkKicking: 92,
      gkPositioning: 80,
      gkReflexes: 86
    };

    const adapted = adaptV2ToV1(goalkeeper);

    expect(adapted.attributes.saving).toBe((84 + 86 + 80 + 78) / 4);
    expect(Object.values(adapted.attributes)).not.toContain(92);
  });

  it("requires goalkeeper v2 inputs to include goalkeeper attributes", () => {
    const goalkeeper = createTestPlayerV2("gk2", "Keeper", "GK2", "GK", 1, 75);
    delete goalkeeper.gkAttributes;

    expect(() => adaptV2ToV1(goalkeeper)).toThrow("requires gkAttributes");
  });
});
