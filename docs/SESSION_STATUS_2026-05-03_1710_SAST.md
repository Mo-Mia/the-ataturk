# Session Status — FootSim Phase 9 Manual XI Investigation

Last updated: 2026-05-03 17:10 SAST

## Current State

FootSim Phase 9 is complete. It investigated the apparent manual-XI
responsiveness decay that paused Phase 8's baseline lock. No engine code,
mechanics, or calibration constants were changed.

Conclusion: **Outcome 1 — sample noise.** Phase 8 can resume against the
current engine state.

## Investigation

The investigation added a dedicated data-package harness:

```bash
pnpm --filter @the-ataturk/data fc25:manual-xi-investigation -- --csv data/fc-25/fixtures/male_players_top5pl.csv --mode all --output packages/match-engine/artifacts/manual-xi-impact-phase9.json
```

Configuration:

- Liverpool vs Manchester City
- Full 90 minutes
- Liverpool `4-3-3`
- Auto Subs off
- Current dynamics on: fatigue, score-state, chance creation, set pieces, and
  side-switch
- Paired seeds: each seed ran once with auto XI and once with rotated XI

Rotation:

- Removed: Van Dijk, Salah, Alexander-Arnold
- Added: Chiesa, Gakpo, Núñez

## Result

```text
Seeds: 1000
Auto XI Liverpool goals: 0.923
Rotated XI Liverpool goals: 0.776
Paired goal delta: -0.147
Impact: -15.93%
Impact SE: 4.31pp
95% interval: -24.37% to -7.48%
```

This restores manual-XI impact above the investigation threshold. The Phase 8
`-8.09%` 200-seed result was a low-sample outlier around a low-scoring metric,
not evidence that later mechanics absorbed personnel quality.

Strand B decomposition was skipped per the sprint rules.

## Documentation Updated

- `docs/PHASE_9_INVESTIGATION_FINDINGS.md`
- `docs/MATCH_ENGINE_MODEL_GAPS.md`
- `docs/DECISIONS.md`
- `docs/BACKLOG.md`

## Next

Resume Phase 8 calibration consolidation. Use the Phase 9 1000-seed manual-XI
result as the current manual-XI baseline, not the Phase 8 200-seed outlier.
