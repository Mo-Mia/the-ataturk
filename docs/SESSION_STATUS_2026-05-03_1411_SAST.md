# Session Status — FootSim Phase 6 Chance Creation + Set Pieces

Last updated: 2026-05-03 14:11 SAST

## Current State

FootSim Phase 6 is implemented and validated. The match engine now has an
explicit chance-creation path for late attacking-third shot intent, plus
taker-aware set pieces for corners, free kicks, and penalties. The workbench and
persisted run summaries expose set-piece counts without changing old run
compatibility.

The headline Phase 6 target passed: in the 200-seed real-squad responsiveness
harness, forcing Liverpool 0-2 down at 75:00 increased final-15 Liverpool shots
from 0.99 to 1.23 (+23.62%).

## Engine Changes

- Added `chance_created`, `corner_taken`, `free_kick_taken`, and
  `penalty_taken` event vocabulary.
- Added `dynamics.chanceCreation` and `dynamics.setPieces` flags.
- Added attacking-third chance creation from progressive passes, through balls,
  crosses, cutbacks, and carries.
- Added late-chase shot intent so score-state urgency can become extra shots,
  not just riskier possession.
- Added deterministic set-piece taker selection from v2 attributes.
- Added corner, free-kick, and penalty restart resolution through the existing
  shot/save/goal pipeline.
- Added set-piece summary diagnostics to snapshots and persisted run summaries.

## Calibration

200-seed v2 rated second-half characterisation:

```text
Shots 10.38, goals 1.68, fouls 5.12, cards 1.43
Set pieces: corners 1.37, direct FKs 0.04, indirect FKs 4.95, penalties 0.08, set-piece goals 0.13
Calibration pass: yes
```

200-seed v2 rated full-90 characterisation:

```text
Shots 17.80, goals 2.65, fouls 9.93, cards 2.75
Set pieces: corners 2.41, direct FKs 0.07, indirect FKs 9.68, penalties 0.15, set-piece goals 0.25
Corner conversion approx 4.6%; penalty conversion 83.9%
Calibration pass: yes
```

Organic penalty frequency was checked before judging conversion. It was
initially below the useful diagnostic floor, so the coarse penalty-frequency
proxy for attacking fouls near the box was tuned. Conversion was only accepted
after the full-match 200-seed sample produced enough penalties to be useful.

## Responsiveness

200-seed real-squad harness:

```text
Mentality: +137.24% Liverpool shots, PASS
Pressing: +241.84% Liverpool fouls, PASS
Tempo: -17.81% possession streak length, PASS
Manual XI rotation: -13.19% Liverpool goals, PASS
Fatigue impact: -3.53% late action success, PASS
Auto Subs: 4.86 total subs/match, PASS
Score-state shot impact: +23.62% final-15 Liverpool shots, PASS
```

The isolated chance-creation feature flag moved final-15 shots only from 0.97
to 0.99 (+2.05%). This is documented as a weak standalone signal. The useful
behaviour is the composition with score-state urgency.

## Documentation Updated

- `docs/CHARACTERISATION_FULL_MATCH.md`
- `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md`
- `docs/MATCH_ENGINE_MODEL_GAPS.md`
- `docs/DECISIONS.md`
- `docs/BACKLOG.md`

## Watch Items

- Chance creation is now effective in late chase states, but may still need more
  visible open-play chance resolution outside urgency contexts.
- Real-squad Liverpool vs Aston Villa produced low penalty volume despite the
  synthetic full-match calibration having enough signal. Re-check once more
  matchups or referee variance exist.
- True half-time side-switch remains deferred and still affects set-piece
  direction assumptions.
