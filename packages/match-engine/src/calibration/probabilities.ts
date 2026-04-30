export const PROBABILITIES = {
  ZONE_ACTION_WEIGHTS: {
    def: { pass: 150, hold: 100, clear: 50, shoot: 0 },
    mid: { pass: 150, hold: 80,  clear: 10, shoot: 3 },
    att: { pass: 100, hold: 40,  clear: 0,  shoot: 25 }
  },

  MENTALITY_MODIFIERS: {
    attacking: { shoot: 1.2, pass: 1.2, clear: 0.8 },
    defensive: { shoot: 0.8, pass: 0.8, clear: 1.5 },
    balanced:  { shoot: 1.0, pass: 1.0, clear: 1.0 }
  },

  ACTION_SUCCESS: {
    pass_base: 0.80,
    shot_on_target_base: 0.45,
    tackle_attempt_base: 0.10,
    foul_on_tackle_base: 0.80,
    yellow_card_base: 0.35,
    red_card_base: 0.015
  }
};
