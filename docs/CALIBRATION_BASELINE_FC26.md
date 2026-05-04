# Calibration Baseline — FC26 Active Dataset

Last updated: 2026-05-04 09:52 SAST

## Purpose

This document records Phase 11's FC26-active measurement pass. It does not
replace `docs/CALIBRATION_BASELINE_PHASE_8.md`; Phase 8 remains the historical
FC25/synthetic-reference baseline. Phase 11 answers a narrower question: what
does the current engine do when the runtime FC dataset is the FC26 import?

No match-engine constants were changed. No tuning happened in this sprint.

## Source Dataset

- Active FC dataset version:
  `fc25-20260504073604-4399cb2b-7d80bef5`.
- Name: `FC25 FC26_20250921.csv 2026-05-04T07:36:04.319Z`.
- Source file:
  `data/fc-25/FC26_20250921.csv`.
- Source SHA-256:
  `4399cb2bcc2a14a2872e76a118f8f4bf64d7954503949c75751a14f33863e3b2`.
- Runtime DB is now active on this FC26 dataset. Phase 8 numbers are no longer
  reproducible against the default runtime DB without reactivating an FC25
  dataset version.

Squad counts:

| Club | Rows |
| --- | ---: |
| Arsenal | 24 |
| Aston Villa | 24 |
| Liverpool | 28 |
| Manchester City | 26 |
| Manchester United | 26 |

Raw report: `packages/match-engine/artifacts/calibration-baseline-fc26.json`
(gitignored runtime artefact).

## Commands

```bash
pnpm --filter @the-ataturk/data migrate
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/FC26_20250921.csv --format fc26
pnpm --filter @the-ataturk/data fc25:fc26-baseline
```

The baseline command exits with status `2` when Bucket 3 metrics exist. That is
intentional: the raw report is still written, but the synthesis requires Mo/SA
review before tuning.

## Sanity

The 50-seed sanity pass formed valid 4-3-3 XIs for all five clubs with no lineup
warnings. Liverpool vs Manchester City full-90 sanity means were: shots `11.46`,
goals `1.80`, fouls `4.44`, cards `1.32`.

## Characterisation

| Duration | Seeds | Shots | Goals | Fouls | Cards | Target pass |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Second half | 200 | 6.98 | 1.31 | 2.19 | 0.68 | FAIL |
| Full 90 | 200 | 12.28 | 2.00 | 4.56 | 1.35 | FAIL |

Standard errors:

| Duration | Shots SE | Goals SE | Fouls SE | Cards SE |
| --- | ---: | ---: | ---: | ---: |
| Second half | 0.22 | 0.08 | 0.10 | 0.06 |
| Full 90 | 0.29 | 0.10 | 0.15 | 0.10 |

Set pieces:

| Duration | Corners | Direct FKs | Indirect FKs | Penalties | Set-piece goals | Penalty conversion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Second half | 1.05 | 0.02 | 2.14 | 0.02 | 0.08 | 50.0% |
| Full 90 | 2.10 | 0.03 | 4.47 | 0.05 | 0.09 | 80.0% |

Classification: the event-volume metrics are the sprint's main finding.
Second-half shots, fouls, and cards plus full-90 shots, goals, fouls, and cards
are Bucket 3 because FC26 real-squad output falls below the Phase 8 target
bands. The suspected mechanism is not FC26 metadata itself; the Phase 11
characterisation uses real Liverpool vs Manchester City squads, while Phase 8
characterisation targets were locked from the synthetic match-engine
characterisation scenario. This needs Mo/SA interpretation before any tuning.

## Responsiveness

| Experiment | Seeds | Baseline | Variant | Delta | Threshold | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Mentality | 200 | 4.620 | 9.495 | +105.52% | 30% | PASS |
| Pressing | 200 | 0.940 | 3.365 | +257.98% | 20% | PASS |
| Tempo | 200 | 3.641 | 2.975 | -18.29% | 15% | PASS |
| Formation wide-delivery diagnostic | 200 | 6.085 | 21.035 | +245.69% | n/a | DIAGNOSTIC |
| Fatigue impact | 200 | 53.355 | 50.261 | -5.80% | 3% | PASS |
| Auto Subs activation | 200 | 0.000 | 6.015 subs/match | n/a | activation | PASS |
| Score-state shot impact | 200 | 1.105 | 1.470 | +33.03% | 15% | PASS |
| Chance creation isolated | 200 | 0.985 | 1.105 | +12.18% | n/a | DIAGNOSTIC |

Responsiveness remains healthy on FC26. Mentality, pressing, tempo, fatigue,
Auto Subs, and score-state shot impact all clear existing gates. Formation and
chance creation are diagnostic-only in this baseline; do not add thresholds
without UAT need.

## Manual XI

Protocol: 1000 paired Liverpool vs Manchester City full-90 seeds, Auto Subs
off, current FC26 4-3-3 auto XI with the top three highest-overall outfield
starters replaced by the top three highest-overall outfield bench players.

Removed:

| Player | ID | OVR | Position | Shirt |
| --- | --- | ---: | --- | ---: |
| Mohamed Salah Hamed Ghalyمحمد صلاح | 209331 | 91 | RM | 11 |
| Virgil van Dijk | 203376 | 90 | CB | 4 |
| Alexander Isak | 233731 | 88 | ST | 9 |

Added:

| Player | ID | OVR | Position | Shirt |
| --- | --- | ---: | --- | ---: |
| Florian Richard Wirtz | 256630 | 89 | AM | 7 |
| Dominik Szoboszlai | 236772 | 83 | AM | 8 |
| Hugo Ekitiké | 257289 | 83 | ST | 22 |

Result:

| Seeds | Auto goals | Rotated goals | Delta | Paired SE | 95% CI | Status |
| ---: | ---: | ---: | ---: | ---: | --- | --- |
| 1000 | 1.163 | 0.906 | -22.10% | 3.91pp | [-29.77%, -14.43%] | PASS |

Manual XI impact is Bucket 1. The FC26 rotation is stronger than the Phase 9
FC25 result (`-15.93%`) and clears the `7%` responsiveness threshold.

## Classification Summary

| Bucket | Count | Metrics |
| --- | ---: | --- |
| Bucket 1 | 7 | Mentality, Pressing, Tempo, Fatigue impact, Auto Subs impact, Score-state shot impact, Manual XI rotation |
| Bucket 2 | 3 | Second-half goals, Formation diagnostic, Chance creation isolated |
| Bucket 3 | 7 | Second-half shots/fouls/cards; full-90 shots/goals/fouls/cards |

Recommendation: surface the Bucket 3 characterisation-volume drift for Mo/SA
discussion before any tuning. Do not tune from this sprint alone. A likely next
decision is whether Phase 11 should define a separate real-squad FC26
characterisation band, or whether the old synthetic target bands remain the
only calibration pass/fail gate and real-squad volume is interpreted separately.
