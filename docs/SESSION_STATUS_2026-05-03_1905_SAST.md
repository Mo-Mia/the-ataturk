# Session Status — 2026-05-03 19:05 SAST

## Summary

FootSim Phase 10 is complete. It investigated chance creation's isolated-toggle
behaviour with 1000 paired seeds and made no engine changes.

The Phase 8 anomaly is closed: chance creation is low-effect in ordinary exact
isolated context, but strongly effective when Liverpool are chasing from a
forced 0-2 deficit at 75:00.

## Implemented

- Added `pnpm --filter @the-ataturk/data fc25:chance-creation-investigation`.
- Added a fixture-backed investigation harness under `packages/data/src/fc25`.
- Added paired metric summary and classification tests.
- Wrote
  `packages/match-engine/artifacts/chance-creation-isolated-impact-phase10.json`
  as the local generated artefact.
- Added `docs/PHASE_10_INVESTIGATION_FINDINGS.md`.
- Updated:
  - `docs/DECISIONS.md`
  - `docs/BACKLOG.md`
  - `docs/MATCH_ENGINE_MODEL_GAPS.md`
  - `docs/CALIBRATION_REFERENCE.md`

## Results

Sanity check:

- 50 seeds with `chanceCreation: false`.
- `0` `chance_created` events.
- PASS.

1000 paired seeds:

| Protocol | Metric | OFF | ON | Delta | 95% CI | Outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Exact isolated | Final-15 Liverpool shots | 1.307 | 1.346 | +2.98% | -5.23% to +11.20% | Outcome 1 |
| Exact isolated | Overall total shots | 10.768 | 11.023 | +2.37% | +0.04% to +4.69% | Outcome 1 |
| Forced deficit | Final-15 Liverpool shots | 1.114 | 1.604 | +43.99% | +33.02% to +54.95% | Outcome 2 |

## Interpretation

- Exact isolated chance creation is low-effect in ordinary match state.
- Overall shots have a tiny statistically detectable lift, but it is below the
  3% materiality threshold.
- Forced-deficit final-15 chance creation is a real stable signal.
- No Phase 7 refactor-impact investigation is needed from these data.

## Verification So Far

- `pnpm --filter @the-ataturk/data test -- test/fc25/chanceCreationIsolatedInvestigation.test.ts`
- `pnpm --filter @the-ataturk/data typecheck`

Full repo verification should run before final handoff.
