# Session Status — FootSim Phase 3 Engine Quality Bundle

Last updated: 2026-05-02 22:05 SAST

## Executive Summary

FootSim Phase 3 is implemented through code and package-level tests. The
workbench now defaults to full-90 simulations and selects formation-aware
starting XIs from real FC25 squads at simulate time.

Important calibration note: full-match 50-seed v2 characterisation is
technically just outside target on goals (`1.98` vs `[2, 6]`). No calibration
constant was changed silently. Second-half v2 characterisation remains exactly
in range.

## Commits In This Sprint

- `c4a9fcb feat(match-engine): add full-match half-time marker`
  - Added `half_time` semantic event.
  - Added generic kick-off helper and away second-half kick-off after the
    half-time boundary.
  - Added `forcedHalfTimeCrossing.ts`, generating `forced-half-time-v2.json`
    from a scripted attacking state around tick 895.

- `b2beea4 test(match-engine): validate full-match characterisation`
  - Added `--duration second_half|full_90` to `characterise.ts`.
  - Kept `second_half` as the default for backward compatibility.
  - Confirmed `--preferred-foot-mode rated` is the standing v2 default.

- `22aae12 feat(data): add formation-aware FC25 XI selector`
  - Added `selectStartingXI`.
  - Added deterministic role templates for `4-4-2`, `4-3-1-2`, `4-3-3`, and
    `4-2-3-1`.
  - Added position/alternative-position/adjacency fallback selection.
  - Fixed FC25 import filtering so the Liverpool whitelist is Premier
    League-only, excluding unrelated non-PL rows with the same team name.

- `118e159 feat(server): select and persist formation-aware XIs`
  - `POST /api/match-engine/simulate` now defaults to `duration: "full_90"`.
  - Loads full squads and selects XI per submitted formation.
  - Persists `summary.duration` and rich `summary.xi`.

- `c718931 feat(web): add duration and XI diagnostics`
  - `/visualise/run` now has a duration selector.
  - Run history rows can expand to show recorded XI.
  - Compare view shows same/different XI and mixed-duration warnings.
  - Batch view shows the batch XI.
  - Event dock renders `half_time`.

## Current Capabilities

- Full-match workbench runs: 1800 ticks, `half_time` at 45:00, `full_time` at
  90:00.
- Second-half workbench runs remain available as `Second half (calibrated)`.
- Formation-aware XI selection from full FC25 squads.
- Persisted run summaries include duration and historical XI data.
- Old persisted runs without `duration` or `xi` remain readable; UI treats
  missing duration as `second_half` and shows "XI not recorded".

## Known Deferral

True half-time side-switching is deferred. Investigation showed attack
direction and zone perspective are spread across movement, pass, dribble,
tackle, shot, pressure, set-piece, shot-distance, and visualiser assumptions.
This needs its own audit and post-refactor full-match characterisation because
shot-distance/shot-quality distribution may move.

## Verification So Far

- `pnpm --filter @the-ataturk/match-engine test` — passed
- `pnpm --filter @the-ataturk/data test` — passed
- `pnpm --filter @the-ataturk/server test` — passed
- `pnpm --filter @the-ataturk/web test` — passed
- `pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration second_half` — passed
- `pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration full_90` — ran, failed only goals by 0.02 below floor

Final close-out still needs:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`

## Next Suggested Decision

Decide whether to accept the full-match goal average of `1.98` as negligible
50-seed drift, run a larger stress sample, or scope a tiny calibration pass.
After that, the next logical sprint is either true half-time side-switching or
Atatürk integration planning with the now full-match-capable workbench.
