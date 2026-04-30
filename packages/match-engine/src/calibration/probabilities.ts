export const PROBABILITIES = {
  ZONE_ACTION_WEIGHTS: {
    def: { pass: 70, hold: 10, clear: 20, shoot: 0 },
    mid: { pass: 75, hold: 20, clear: 5, shoot: 0 },
    att: { pass: 50, hold: 20, clear: 0, shoot: 30 }
  },

  MENTALITY_MODIFIERS: {
    attacking: { shoot: 1.2, pass: 1.2, clear: 0.8 },
    defensive: { shoot: 0.8, pass: 0.8, clear: 1.5 },
    balanced:  { shoot: 1.0, pass: 1.0, clear: 1.0 }
  },

  ACTION_SUCCESS: {
    pass_base: 0.80,
    shot_on_target_base: 0.45,
    tackle_attempt_base: 0.30,
    foul_on_tackle_base: 0.20,
    yellow_card_base: 0.10,
    red_card_base: 0.005
  }
};
