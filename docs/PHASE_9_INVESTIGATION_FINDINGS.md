# Phase 9 Investigation Findings — Manual XI Impact

Last updated: 2026-05-03 17:10 SAST

## Question

Manual XI rotation impact appeared to decay from Phase 4's `-18.37%` to Phase
8's `-8.09%` 200-seed baseline run. Phase 9 investigated whether that was
sample noise, intentional engine evolution, or unintentional behaviour
absorption.

No engine code or calibration constants were changed.

## Method

The investigation used the tracked FC25 fixture:
`data/fc-25/fixtures/male_players_top5pl.csv`.

Matchup:

- Liverpool home vs Manchester City away
- `full_90`
- Liverpool `4-3-3`
- Auto Subs off, to isolate personnel choice
- Current dynamics on: fatigue, score-state, chance creation, set pieces, and
  side-switch

Rotation:

- Start from Liverpool's automatic `4-3-3` XI.
- Remove the top three highest-overall outfield starters: Van Dijk, Salah, and
  Alexander-Arnold.
- Add the top three highest-overall outfield bench players: Chiesa, Gakpo, and
  Núñez.

Analysis used paired seeds: each seed ran once with the auto XI and once with
the rotated XI. Standard error is calculated from the per-seed paired goal
deltas.

Command:

```bash
pnpm --filter @the-ataturk/data fc25:manual-xi-investigation -- --csv data/fc-25/fixtures/male_players_top5pl.csv --mode all --output packages/match-engine/artifacts/manual-xi-impact-phase9.json
```

## Strand A Result

```text
Seeds: 1000
Auto XI Liverpool goals: 0.923
Rotated XI Liverpool goals: 0.776
Paired goal delta: -0.147
Paired goal delta SE: 0.0398
Impact: -15.93%
Impact SE: 4.31pp
95% interval: -24.37% to -7.48%
```

Interpretation: tighter sampling restores the manual XI impact above the
investigation threshold. Phase 8's `-8.09%` 200-seed result was sampling and
threshold noise, not evidence that later mechanics absorbed personnel quality.

Strand B decomposition was skipped per sprint rules because Strand A classified
the issue as sample noise.

## Classification

**Outcome 1 — sample noise.**

Manual XI impact remains materially strong in the current engine. The observed
trajectory across phases is best understood as stochastic variance around a
low-scoring outcome metric, not a structural decay that needs tuning.

## Recommendation

Phase 8 can resume against the current engine state.

For Phase 8, use the Phase 9 1000-seed result as the manual-XI baseline rather
than the Phase 8 200-seed outlier. Any future manual-XI threshold should account
for the wide confidence interval around a low absolute goal rate.
