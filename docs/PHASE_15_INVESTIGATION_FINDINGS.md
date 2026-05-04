# Phase 15 Investigation Findings: Modulation Saturation

Date: 2026-05-04  
Runtime dataset: `fc25-20260504102445-4399cb2b-a504ee92` (`FC26 PL20 import 2026-05-04`)  
Commits: `53a5beb`, `d12a0da`

## Summary

Phase 14 A5 moved PL20 shots into the real-PL band (`22.24`/match) but broke
score-state shot impact (`-1.69%`). Phase 15 diagnosed the failure as
probability-budget compression in carrier-action selection, not a hard clamp.

The alpha probe passed. It lands PL20 shots/goals in band, restores score-state
shot impact to `+39.33%`, and preserves all non-diagnostic responsiveness
thresholds. Shots are in band but low-band (`21.35` against `[19.4, 30.2]`), so
Phase 14b should treat shot volume as a guarded floor while tuning fouls and
corners.

## Strand A: Code-Path Diagnosis

Carrier action selection lives in
`packages/match-engine/src/resolution/carrierAction.ts`.

The decisive path is:

1. `selectCarrierAction` copies `ACTION_WEIGHTS[zone][pressure]`.
2. It multiplies action weights by mentality, tempo, player attributes, shot
   distance, and score-state urgency.
3. It applies late-chase shot intent for attacking-zone carriers when urgency is
   high enough.
4. It samples from the post-modulation weights by rolling against their sum.

The formula is:

```text
p(action) = w_action / (w_pass + w_shoot + w_dribble + w_hold + w_clear)
```

There is no hard clamp on carrier-action weights. The saturation mechanism is
sum-normalisation: when baseline `w_shoot` is already high, `w_shoot / total`
occupies more of the probability budget, so multiplying `w_shoot` by urgency
produces less useful relative separation between tied and trailing contexts.

Score-state shoot modulation comes through two paths:

- `SCORE_STATE.action.shoot` in `applyScoreStateWeights`
- `SCORE_STATE.lateChaseShotIntent` in `applyLateChaseShotIntent`

Mentality and tempo use the same sum-normalised carrier-action path. Tackle
attempts do not: `rollPressureTackle` uses direct probability multiplication by
pressure, pressing, urgency, tackling, and stamina.

## Strand B: Headroom Characterisation

Static headroom table from `pnpm --filter @the-ataturk/data fc25:phase15-modulation`:

| Config | Shoot headroom | Pass headroom | Dribble headroom | Tackle headroom |
| --- | ---: | ---: | ---: | ---: |
| Phase 8 / pre-A5 | `0.4810` | `0.0356` | `0.0125` | `0.0115` |
| A5 | `0.3773` | `0.0347` | `0.0009` | `0.0115` |
| Alpha | `0.4266` | `0.0347` | `0.0020` | `0.0115` |

Alpha's specific magnitude was chosen because it recovers about half the
headroom lost by A5 without returning to Phase 8's low shot supply:

- Attacking-zone shoot weights: `85%` of A5
- `SCORE_STATE.action.shoot`: `1.28 -> 1.85`
- `SCORE_STATE.lateChaseShotIntent`: `30 -> 42`
- `SCORE_STATE.maxUrgency`: unchanged at `1.4`

The generality finding is important: saturation is a property of the
sum-normalised carrier-action path. Phase 14b foul tuning uses direct tackle
attempt probabilities, so it should be a simpler calibration problem.

## Strand C: Options

Option alpha, lower baselines plus stronger modulators, was selected because it
requires constant changes only and directly targets the lost score-state
headroom. It has a moderate risk: future baseline tuning must keep modulation
headroom in view.

Option beta, transformed-scale modulation, is more durable but would change the
carrier-action architecture and require a new calibration baseline.

Option gamma, accepting compressed modulation, was rejected because it would
make score-state shot impact effectively documentation-only after event-volume
tuning.

Option delta, reserving modulation probability budget, is promising but too
large for this bounded investigation. It remains the architectural fallback if
future tuning repeatedly runs into sum-normalisation compression.

## Strand D: Alpha Probe

PL20 50-seed fixture matrix:

| Metric | Alpha | Band | Classification |
| --- | ---: | ---: | --- |
| Shots/match | `21.35` | `[19.4, 30.2]` | Pass, low-band |
| Goals/match | `1.93` | `[1.16, 4.34]` | Pass |
| Fouls/match | `4.12` | `[16.6, 26.6]` | Still Phase 14b target |
| Cards/match | `1.01` | `[1.83, 5.87]` | Still Phase 14b target |
| Corners/match | `2.80` | `[6.7, 13.2]` | Still Phase 14b target |

Shot composition:

| Source | Shots/match |
| --- | ---: |
| Att-zone carrier shots | `14.34` |
| Mid-zone carrier shots | `6.41` |
| Speculative-distance shots | `3.76` |
| Set-piece shots | `0.48` |
| Chance-creation shots | `0.13` |

Responsiveness gate:

| Experiment | Result |
| --- | --- |
| Mentality | `+81.90%` PASS |
| Pressing | `+220.67%` PASS |
| Tempo | `-18.36%` PASS |
| Fatigue impact | `-3.31%` PASS |
| Auto Subs | activation PASS |
| Score-state shot impact | `+39.33%` PASS |
| Manual XI | `-19.69%`, SE `3.70pp` |

## Handoff To Phase 14b

Phase 14b should resume from the alpha configuration and proceed to Strand B
foul genesis tuning. Starting guardrails:

- Keep shots within `[19.4, 30.2]`; alpha starts at `21.35`, so it has floor
  risk if foul tuning suppresses shot supply.
- Keep goals within `[1.16, 4.34]`; alpha starts at `1.93`.
- Preserve score-state shot impact at `>= +15%`; alpha starts at `+39.33%`.
- Treat foul tuning as direct probability calibration, not a repeat of
  carrier-action saturation.

Phase 8 retirement remains deferred to Phase 14b after foul/corner tuning and
the final calibration baseline are locked.
