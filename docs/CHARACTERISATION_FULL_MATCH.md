# Full-Match Characterisation

Last updated: 2026-05-02 22:05 SAST

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
