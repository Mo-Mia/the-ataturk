# Phase 10 Investigation Findings — Chance Creation Isolated Toggle

Last updated: 2026-05-03 19:05 SAST

## Question

Phase 10 investigated the isolated-toggle effect of chance creation after Phase
8 surfaced an apparent anomaly.

Repo-truth correction: Phase 8's `-7.14%` measurement was not overall match
shots. It was Liverpool final-15 shots in the existing isolated chance-creation
diagnostic. Phase 10 therefore measured:

- exact isolated final-15 Liverpool shots,
- exact isolated overall match shots,
- forced-deficit final-15 Liverpool shots.

No engine code or calibration constants were changed.

## Method

Tracked fixture:

```text
data/fc-25/fixtures/male_players_top5pl.csv
```

Match setup:

- Liverpool vs Manchester City.
- Liverpool `4-3-3` auto XI.
- Manchester City `4-2-3-1` auto XI.
- Default tactics.
- Auto Subs off.
- Fatigue, score-state, set pieces, and side-switch on.
- Paired-seed comparison: `chanceCreation: false` vs `chanceCreation: true`.

Command:

```bash
pnpm --filter @the-ataturk/data fc25:chance-creation-investigation -- --csv data/fc-25/fixtures/male_players_top5pl.csv --seeds 1000 --output packages/match-engine/artifacts/chance-creation-isolated-impact-phase10.json
```

Sanity check:

```text
50 seeds with chanceCreation OFF produced 0 chance_created events.
PASS — the flag disables the mechanism cleanly.
```

## Results

| Protocol | Metric | OFF avg | ON avg | Delta | SE | 95% CI | Classification |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Exact isolated | Final-15 Liverpool shots | 1.307 | 1.346 | +2.98% | 4.19pp | -5.23% to +11.20% | Outcome 1 |
| Exact isolated | Overall total shots | 10.768 | 11.023 | +2.37% | 1.19pp | +0.04% to +4.69% | Outcome 1 |
| Forced deficit | Final-15 Liverpool shots | 1.114 | 1.604 | +43.99% | 5.59pp | +33.02% to +54.95% | Outcome 2 |

Diagnostics:

| Protocol | Chance-created events OFF | Chance-created events ON | Converted chance events ON |
| --- | ---: | ---: | ---: |
| Exact isolated | 0.000 | 2.785 | 0.122 |
| Forced deficit | 0.000 | 2.762 | 0.123 |

## Classification

### Exact isolated final-15 shots — Outcome 1

Effect is below the `3%` materiality threshold and the 95% interval overlaps
zero. Phase 6's `+2.05%`, Phase 8's `-7.14%`, and Phase 10's `+2.98%` are best
read as small-sample movement around a low-effect isolated metric.

Recommendation: document as low-effect-in-isolation. No tuning.

### Exact isolated overall shots — Outcome 1

Effect is statistically detectable but still below the `3%` materiality
threshold. The result is `+2.37%`, with a tight 95% interval of `+0.04%` to
`+4.69%`. That is useful texture, not enough to justify a responsiveness gate or
tuning sprint.

Recommendation: document as low-effect-in-isolation. No tuning.

### Forced-deficit final-15 shots — Outcome 2

When Liverpool are forced 0-2 down at 75:00, chance creation has a large,
stable isolated effect: `+43.99%` final-15 Liverpool shots. This explains why
Phase 6's score-state composition gate is green: chance creation matters most
when score-state urgency has created the right tactical context.

Recommendation: lock `+43.99%` as the current empirical baseline for
chance-creation-under-chase-context. No tuning.

## Conclusion

The Phase 8 anomaly is closed. Chance creation is intentionally low-effect in a
normal, exact-isolated context, but strongly positive under late chase
conditions. The mechanism is not broken and Phase 7's side-switch refactor does
not require a follow-up investigation from these data.
