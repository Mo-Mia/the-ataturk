# FootSim Real-Squad Responsiveness

Last updated: 2026-05-03 11:03 SAST

## Purpose

This report records the first responsiveness pass using real FC25 squads through
the workbench data path. It complements the earlier synthetic responsiveness
harness by checking that tactics and manual line-up choices still move outcomes
once FC25-distributed players, formation-aware XIs, and full-match simulations
are involved.

## Harness

- Script: `pnpm --filter @the-ataturk/data fc25:responsiveness -- --csv data/fc-25/male_players.csv --seeds 50`
- Output artefact: `packages/match-engine/artifacts/real-squad-responsiveness-report.json` (ignored runtime artefact; summary captured here)
- Matchup: Liverpool home vs Manchester City away
- Duration: `full_90`
- Baseline tactics: `4-3-3`, balanced mentality, normal tempo, medium pressing, normal line height, normal width
- Seed count: 50 per side of each comparison

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
| Mentality: defensive → attacking | Liverpool shots | 3.16 | 8.62 | +172.78% | 30% | PASS |
| Pressing: low → high | Liverpool fouls | 1.24 | 4.48 | +261.29% | 20% | PASS |
| Tempo: slow → fast | Liverpool possession streak | 3.44 | 2.86 | -16.67% | 15% | PASS |
| Manual XI: auto → rotated | Liverpool goals | 0.98 | 0.80 | -18.37% | 15% | PASS |

Tempo again moves in the football-correct direction: faster tempo shortens
possession streaks because it increases risk and turnover frequency.

The manual XI result is the key Sprint 4 finding. Rotating out three elite
outfield starters reduced Liverpool goals by 18.37%, clearing the 15%
responsiveness threshold. Manual XI selection therefore has a measurable impact
without requiring engine changes.

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
