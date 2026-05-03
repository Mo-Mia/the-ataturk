# Full-Match Characterisation

Last updated: 2026-05-03 14:11 SAST

## Scope

FootSim Phase 3 validates `duration: "full_90"` without changing calibration
constants. The canonical engine duration token remains `full_90`; the
characterisation script keeps `second_half` as its default for backward
compatibility and accepts `--duration full_90` for 90-minute runs.

The standing preferred-foot diagnostic default is `--preferred-foot-mode rated`.
This is the normal v2 mode, not a one-off sprint flag.

## Targets

Full-match targets are doubled from the calibrated second-half target bands:

| Metric | Second-half target | Full-match target |
| --- | ---: | ---: |
| Shots | 8-12 | 16-24 |
| Goals | 1-3 | 2-6 |
| Fouls | 4-8 | 8-16 |
| Cards | 1-3 | 2-6 |
| Max single score share | <=40% | <=40% |

## 50-Seed Baseline

Command:

```bash
pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration full_90
```

Result:

```text
=== Match Engine Characterisation (50 seeds, full 90, v2, preferred-foot rated) ===
Shots: 16.76 target [16, 24]
Goals: 1.98 target [2, 6]
Fouls: 10.34 target [8, 16]
Cards: 2.58 target [2, 6]
Average elapsed: 67.68ms
Score distribution:
  0-0: 10 (20%)
  1-0: 7 (14%)
  0-1: 6 (12%)
  2-1: 6 (12%)
  3-1: 4 (8%)
  1-1: 3 (6%)
  2-0: 3 (6%)
  2-2: 2 (4%)
Calibration pass: no
```

Interpretation: full-match texture is effectively in range, but goals are
technically 0.02 below the doubled target floor. Per sprint rules, calibration
was not tuned silently. Mo needs to decide whether to accept this as negligible
50-seed drift, run a larger stress sample, or scope a small calibration pass.

## 200-Seed Stress Check

Command:

```bash
pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration full_90 --seeds 200
```

Result:

```text
=== Match Engine Characterisation (200 seeds, full 90, v2, preferred-foot rated) ===
Shots: 16.59 target [16, 24]
Goals: 2.23 target [2, 6]
Fouls: 9.73 target [8, 16]
Cards: 2.75 target [2, 6]
Average elapsed: 67.94ms
Score distribution:
  1-0: 30 (15%)
  1-1: 28 (14%)
  0-0: 23 (12%)
  2-1: 18 (9%)
  2-0: 17 (9%)
  0-1: 17 (9%)
  3-1: 12 (6%)
  1-2: 11 (6%)
Calibration pass: yes
```

Interpretation: the larger sample clears the doubled full-match target bands.
The 50-seed goals miss was sampling noise, not a calibration defect. No
probability constants were changed.

## Second-Half Regression Check

Command:

```bash
pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration second_half
```

Result:

```text
=== Match Engine Characterisation (50 seeds, second half, v2, preferred-foot rated) ===
Shots: 8.28 target [8, 12]
Goals: 1.00 target [1, 3]
Fouls: 5.20 target [4, 8]
Cards: 1.16 target [1, 3]
Average elapsed: 36.46ms
Score distribution:
  0-3: 20 (40%)
  1-3: 9 (18%)
  0-4: 7 (14%)
  1-4: 4 (8%)
  1-5: 3 (6%)
  2-3: 2 (4%)
  0-5: 2 (4%)
  2-4: 2 (4%)
Calibration pass: yes
```

Second-half calibration remains unchanged and in range.

## Phase 5 Baseline After Fatigue/Substitution Tuning

Phase 5 added fatigue, substitutions, and score-state behaviour. Characterisation
now runs with the same defaults as the workbench: fatigue on, score-state on,
and Auto Subs on.

The Auto Subs fatigue threshold is data-backed: active-player stamina was
sampled from minute 70 onward across 200 Liverpool vs Manchester City real-squad
seeds with Auto Subs off. The 25th percentile was `51`, so
`SUBSTITUTIONS.fatigueThreshold` is set to `51`.

Second-half check:

```text
=== Match Engine Characterisation (50 seeds, second half, v2, preferred-foot rated) ===
Shots: 8.04 target [8, 12]
Goals: 1.24 target [1, 3]
Fouls: 5.38 target [4, 8]
Cards: 1.44 target [1, 3]
Calibration pass: yes
```

Full-match check:

```text
=== Match Engine Characterisation (50 seeds, full 90, v2, preferred-foot rated) ===
Shots: 16.54 target [16, 24]
Goals: 2.10 target [2, 6]
Fouls: 9.86 target [8, 16]
Cards: 2.70 target [2, 6]
Calibration pass: yes
```

Interpretation: Phase 5 mechanics preserve both second-half and full-match
calibration bands. Fatigue drain was increased modestly, fatigue effect
penalties were softened to avoid suppressing full-match goals, and `saveBase`
was reduced from `0.42` to `0.405` to keep full-match goal conversion above the
floor.

## Phase 6 Baseline After Chance Creation + Set Pieces

Phase 6 added two shot-generation surfaces: explicit chance creation for late
attacking-third shot intent, and taker-aware corners, free kicks, and penalties.
Characterisation still uses the Phase 5 defaults: fatigue on, score-state on,
Auto Subs on, preferred-foot mode rated.

Second-half 200-seed check:

```text
=== Match Engine Characterisation (200 seeds, second half, v2, preferred-foot rated) ===
Shots: 10.38 target [8, 12]
Goals: 1.68 target [1, 3]
Fouls: 5.12 target [4, 8]
Cards: 1.43 target [1, 3]
Set pieces: corners 1.37, direct FKs 0.04, indirect FKs 4.95, penalties 0.08, set-piece goals 0.13
Set-piece goals by source: corners 0.05, direct FKs 0.01, penalties 0.07
Penalty conversion: 87.5%
Calibration pass: yes
```

Full-match 200-seed check:

```text
=== Match Engine Characterisation (200 seeds, full 90, v2, preferred-foot rated) ===
Shots: 17.80 target [16, 24]
Goals: 2.65 target [2, 6]
Fouls: 9.93 target [8, 16]
Cards: 2.75 target [2, 6]
Set pieces: corners 2.41, direct FKs 0.07, indirect FKs 9.68, penalties 0.15, set-piece goals 0.25
Set-piece goals by source: corners 0.11, direct FKs 0.01, penalties 0.13
Penalty conversion: 83.9%
Calibration pass: yes
```

Interpretation: both calibrated duration bands remain green after the Phase 6
shot-generation bundle. Organic penalty volume was initially below the useful
diagnostic floor (`<0.1` per full match), so the coarse "attacking foul near the
box" penalty proxy was tuned before any conversion claim was made. Full-match
penalties now average `0.15` per match, giving enough 200-seed signal to check
conversion. Penalty conversion is inside the 70-85% target band on the full-90
sample. Corner conversion lands at roughly `0.11 / 2.41 = 4.6%`, inside the
2-6% target band.
