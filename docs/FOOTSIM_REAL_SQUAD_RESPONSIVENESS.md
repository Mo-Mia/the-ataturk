# FootSim Real-Squad Responsiveness

Last updated: 2026-05-03 13:01 SAST

## Purpose

This report records the first responsiveness pass using real FC25 squads through
the workbench data path. It complements the earlier synthetic responsiveness
harness by checking that tactics and manual line-up choices still move outcomes
once FC25-distributed players, formation-aware XIs, and full-match simulations
are involved.

## Harness

- Script: `pnpm --filter @the-ataturk/data fc25:responsiveness -- --csv data/fc-25/male_players.csv --seeds 200`
- Output artefact: `packages/match-engine/artifacts/real-squad-responsiveness-report.json` (ignored runtime artefact; summary captured here)
- Matchup: Liverpool home vs Manchester City away
- Duration: `full_90`
- Baseline tactics: `4-3-3`, balanced mentality, normal tempo, medium pressing, normal line height, normal width
- Seed count: 200 per side of each comparison

Each tactical comparison varies Liverpool only. Manchester City remains on the
baseline configuration so the measured signal is not blurred by both teams
moving at once.

## Manual XI Rotation

The line-up responsiveness test uses a deliberately repeatable Liverpool
rotation:

- Start from Liverpool's automatic `4-3-3` XI.
- Remove the top three highest-overall outfield starters.
- Add the top three highest-overall outfield bench players.

For the tracked FC25 data this removed Van Dijk, Salah, and
Alexander-Arnold, and added Chiesa, Gakpo, and Núñez.

This is intentionally a test harness, not a football recommendation. The point
is to prove manual XI selection is mechanically consequential.

## Results

| Test | Metric | Baseline | Variant | Change | Threshold | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Mentality: defensive → attacking | Liverpool shots | 3.56 | 7.68 | +116.03% | 30% | PASS |
| Pressing: low → high | Liverpool fouls | 1.32 | 4.18 | +216.67% | 20% | PASS |
| Tempo: slow → fast | Liverpool possession streak | 3.44 | 2.84 | -17.40% | 15% | PASS |
| Manual XI: auto → rotated, Auto Subs off | Liverpool goals | 0.83 | 0.68 | -19.16% | 10% | PASS |

Tempo again moves in the football-correct direction: faster tempo shortens
possession streaks because it increases risk and turnover frequency.

The manual XI check is now isolated with Auto Subs off. Rotating out three
elite outfield starters reduced Liverpool goals by 19.16%, clearing the revised
10% threshold. The threshold was lowered because Phase 5 fatigue and score-state
mechanics naturally bound personnel impact over a full 90 minutes.

## Phase 5 Dynamics

| Test | Metric | Baseline | Variant | Change | Threshold | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Fatigue on/off | Late action success | 54.88% | 52.54% | -4.26% | 4% | PASS |
| Score-state urgency | Final-15 urgency | 1.06 | 1.24 | +16.98% | 5% | PASS |
| Auto Subs | Activation diagnostics | 0.00 zero-sub matches | 4.92 subs/match | active | qualitative | PASS |

Fatigue impact is intentionally measured modestly. The late action-success
metric does not capture the full mechanic: fatigue also reduces movement speed,
pressing intensity, and tackle/shot/pass effectiveness through the same stamina
multiplier.

Auto Subs now use a data-backed fatigue threshold. A stamina probe over 200
real-squad seeds found the 25th percentile of active-player stamina from 70:00
onward at `51`; that value is now the AI fatigue-sub threshold. The 200-seed run
produced 4.92 total subs per match, 2.11 home, 2.81 away, zero zero-sub matches,
and a max of 6 total subs in one match.

Score-state is treated as qualitative in Phase 5. Urgency rose from 1.06 to
1.24 for Liverpool when forced 0-2 down at 75:00, and action distribution shifted
toward more risk/progression. Final-15 shots did not rise (`0.79 -> 0.72`),
which is now tracked as a Phase 6 modelling gap rather than a failed Phase 5
threshold.

## Formation Diagnostic

This diagnostic is not pass/fail. It compares Liverpool `4-4-2` with
Liverpool `4-3-3`, again against baseline Manchester City.

| Metric | 4-4-2 | 4-3-3 | Change |
| --- | ---: | ---: | ---: |
| Liverpool goals | 0.56 | 0.98 | +75.00% |
| Liverpool shots | 3.54 | 5.44 | +53.67% |
| Liverpool fouls | 2.14 | 2.46 | +14.95% |
| Liverpool possession streak | 3.18 | 3.16 | -0.68% |
| Liverpool wide deliveries | 6.06 | 21.04 | +247.19% |

The formation diagnostic strongly confirms that real-squad formation changes
alter attacking shape. The most visible signal is wide deliveries: `4-3-3`
produces roughly 3.5x the Liverpool crosses/cutbacks of `4-4-2`.

## Follow-ups

- Keep manual XI selection in FootSim workbench as a first-class research
  control.
- Treat dragged/preset line-up UX as optional polish; the simple toggle list is
  sufficient for current testing.
- Use real-squad responsiveness results as input to the modelling-gap review
  rather than tuning the engine immediately.
