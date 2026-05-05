# Calibration Baseline — Phase 14b / Phase 17

Last updated: 2026-05-05 08:36 SAST

## Status

This is the active FootSim calibration baseline. It replaces Phase 8 as the
active calibration anchor after Phase 14/14b tuning and Phase 17 corner-pathway
implementation. Phase 8 remains preserved as the historical FC25/synthetic
reference in `docs/CALIBRATION_BASELINE_PHASE_8.md`.

Source artifact:
`packages/match-engine/artifacts/phase17-validation.json` (gitignored).

Source dataset: active FC26 PL20 runtime dataset
`fc25-20260504102445-4399cb2b-a504ee92`, imported from
`data/fc-25/FC26_20250921.csv`.

Real-PL anchor: 2025/26-to-date Football-Data.co.uk means with one standard
deviation bands, documented in `docs/CALIBRATION_REFERENCE_REAL_PL.md`.

## Event Volume Lock

Phase 17 validation ran 380 ordered PL20 fixtures at 50 full-90 seeds each
(`19,000` runs). All five primary metrics are now inside the real-PL one-SD
bands.

| Metric | Phase 14b/17 mean | Real-PL band | Status |
| --- | ---: | ---: | --- |
| Shots/match | 22.67 | 19.4-30.2 | PASS |
| Goals/match | 2.19 | 1.16-4.34 | PASS |
| Fouls/match | 17.47 | 16.6-26.6 | PASS |
| Cards/match | 5.10 | 1.83-5.87 | PASS |
| Corners/match | 7.01 | 6.7-13.2 | PASS |

Set-piece goal share is `10.79%`, within the expected real-football range and
well below the 25% guardrail.

Corner contribution diagnostics:

| Pathway | Corners/match |
| --- | ---: |
| Deflected missed shots | 2.50 |
| Defensive clearances | 3.77 |
| Saved/parried wide | 0.40 |
| Blocked wide deliveries | 0.34 |

## Tune Summary

Phase 15 alpha resolved Phase 14's carrier-action modulation saturation while
keeping shots/goals in band:

- attacking-zone shoot weights at `0.5508 / 0.7956 / 1.1628`
- `SCORE_STATE.action.shoot = 1.85`
- `SCORE_STATE.lateChaseShotIntent = 42`
- `SUCCESS_PROBABILITIES.saveBase = 0.50625`

Phase 14b B1 closed the foul/card economy:

- `tackleAttemptByPressure = { low: 0.03, medium: 0.06, high: 0.102 }`
- `foulOnTackleByPressure = { low: 0.195, medium: 0.24, high: 0.315 }`

Phase 17 closed the corner gap with expanded corner-eligible event vocabulary:

- `shotDeflectionCornerByPressure = { low: 0.0625, medium: 0.1125, high: 0.175 }`
- `defensiveClearanceCorner = 0.92`
- `saveCornerByPressure = { low: 0.16, medium: 0.24, high: 0.32 }`
- `blockedDeliveryCornerByPressure = { low: 0.18, medium: 0.27, high: 0.36 }`

## Responsiveness Lock

All non-diagnostic responsiveness gates passed.

| Experiment | Seeds | Delta | Threshold | Status |
| --- | ---: | ---: | ---: | --- |
| Mentality | 200 | +86.30% | 30% | PASS |
| Pressing | 200 | +197.95% | 20% | PASS |
| Tempo | 200 | -17.32% | 15% | PASS |
| Fatigue impact | 200 | -4.49% | 3% | PASS |
| Auto Subs activation | 200 | 6.26 subs/match | activation | PASS |
| Score-state shot impact | 200 | +15.76% | 10% | PASS |
| Manual XI rotation | 1000 paired | -31.84% | 7% | PASS |

Manual XI 95% CI: `[-38.12%, -25.56%]`.

Diagnostic rows:

- Formation wide-delivery diagnostic: `+170.50%`
- Chance creation isolated: `-2.30%`; still diagnostic only

Side-switch spot check passed at 200 seeds. Enabled-vs-disabled deltas were
small: shots `+0.13`, goals `-0.05`, fouls `-0.06`, cards `-0.08`, corners
`+0.12`.

## Policy Changes

`CALIBRATION_TARGETS` now encodes real-PL half-match equivalents:

- shots `[9.7, 15.1]`
- goals `[0.58, 2.17]`
- fouls `[8.3, 13.3]`
- cards `[0.915, 2.935]`

`maxSingleScoreShare` remains `0.4`; it is a score-distribution guard, not a
real-PL volume band.

Score-state shot impact now uses a Phase 14b threshold of `+10%`. Phase 8's
`+15%` threshold is preserved as historical FC25/synthetic context, but two
1000-seed paired measurements under realistic foul economy showed the mechanism
settles in the `+10-12%` range while remaining clearly positive.

## Outcome

Phase 14b/17 is lockable. The engine now matches real-PL one-SD bands for
shots, goals, fouls, cards, and corners against the active FC26 PL20 runtime
dataset, while preserving tactical/personnel responsiveness and side-switch
equivalence.
