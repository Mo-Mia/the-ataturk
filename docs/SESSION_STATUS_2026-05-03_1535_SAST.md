# Session Status — FootSim Phase 7 True Side-Switch

Last updated: 2026-05-03 15:35 SAST

## Current State

FootSim Phase 7 is implemented and validated. New full-match runs now flip
attacking direction at half-time, while old persisted runs keep the legacy
single-direction convention through `sideSwitchVersion: 0`.

This was a fidelity refactor, not a calibration sprint. No probability
constants were changed. The proof point is behavioural equivalence with
spatial difference: match means stay statistically indistinguishable, while
home attacking territory visibly moves to the opposite end after half-time.

## Engine Changes

- Added per-team `attackDirection` to mutable match state and snapshot ticks.
- Added `sideSwitchVersion` to snapshot metadata and persisted run summaries.
- Full-match runs default to side-switch on.
- `second_half` runs now initialise in the post-half-time direction. This is an
  intentional semantic change with no expected statistical impact.
- Refactored direction-aware reads across movement, pass, dribble, tackle,
  clearance, shot distance, pressure, chance creation, carrier action,
  momentum, set pieces, and snapshot diagnostics.
- Kept legacy helpers for old-run compatibility and marked them explicitly with
  `LEGACY` comments.
- Added `forced-side-switch-v2.json` generation script and replay fixture test.

## Visualiser Changes

- New runs render with home attacking different ends in different halves,
  matching real match convention.
- Old runs keep legacy rendering.
- Ball heatmaps stay raw coordinate maps.
- Team attacking-territory and player-relative heatmap diagnostics use current
  team direction.

This convention shift is intentional. If UAT reports that Liverpool appears to
change direction at half-time, that is now correct behaviour.

## Validation

500-seed side-switch A/B:

```text
PASS shots: off=13.152 on=13.292 diff=0.140 threshold=0.529
PASS goals: off=5.104 on=5.006 diff=0.098 threshold=0.175
PASS fouls: off=7.304 on=7.422 diff=0.118 threshold=0.328
PASS cards: off=2.026 on=2.112 diff=0.086 threshold=0.212
PASS possession: off=47.184 on=47.378 diff=0.194 threshold=0.222
PASS corners: off=2.064 on=2.070 diff=0.006 threshold=0.195
PASS setPieceGoals: off=0.136 on=0.126 diff=0.010 threshold=0.045
```

200-seed v2 rated characterisation:

```text
Second half: shots 10.45, goals 1.63, fouls 5.18, cards 1.43 — PASS
Full 90: shots 18.06, goals 2.73, fouls 9.62, cards 2.77 — PASS
```

Spatial validation over 50 side-switch-on runs:

```text
Home shots first half: 148 shots, avg y=660.3
Home shots second half: 146 shots, avg y=373.9
```

This confirms the home team attacks one end in the first half and the opposite
end in the second half.

Real-squad responsiveness regression over 50 seeds passed overall. The
isolated chance-creation feature-flag diagnostic remains weak, as already
documented from Phase 6, but the score-state composition gate remains green.

## Documentation Updated

- `docs/SIDE_SWITCH_AUDIT.md`
- `docs/CHARACTERISATION_FULL_MATCH.md`
- `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md`
- `docs/MATCH_ENGINE_MODEL_GAPS.md`
- `docs/DECISIONS.md`
- `docs/BACKLOG.md`

## Watch Items

- Add a replay direction indicator if UAT users need clearer orientation.
- Side-switch animation is polish only; current behaviour is intentionally
  instant at half-time.
- Keep an eye on old-run compatibility whenever future visualiser heatmap or
  replay rendering changes land.
