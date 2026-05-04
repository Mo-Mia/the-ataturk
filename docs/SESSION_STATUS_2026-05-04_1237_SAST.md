# Session Status — 2026-05-04 12:37 SAST

## Where The Project Stands

FootSim is FC26-active and now uses all 20 English Premier League clubs from
`data/fc-25/FC26_20250921.csv` in the runtime SQLite DB. Phase 13.5 was inserted
before Phase 14 because tuning against only the original five clubs risked
missing squad-distribution effects from the complete league dataset.

No engine tuning landed. The event-volume gap persists at PL20 scale, so Phase
14 remains valid: tune baseline shot supply first, foul genesis second, then
retest corners.

## Runtime DB State

- Active FC dataset: `fc25-20260504102445-4399cb2b-a504ee92`
- Dataset name: `FC26 PL20 import 2026-05-04`
- Clubs: 20
- Players / squad rows: 547
- Source: `data/fc-25/FC26_20250921.csv`
- Source filter: English Premier League via `league_id = 13`

This runtime DB mutation is intentional and persists across sessions. Future
match-engine runs against the default DB are PL20 FC26 runs unless a caller
explicitly activates another dataset version.

## What Landed

- Expanded FC26 importer club universe support with `--club-universe footsim|pl20`.
- Preserved the original five-club FootSim import as the default path.
- Added all 20 English Premier League FC26 club definitions.
- Kept the no-cap import default and retained warning-only behaviour for squads
  above 35 players. Sunderland warns at 36 players and imports successfully.
- Made server match-engine club validation active-dataset aware.
- Kept Squad Manager football-data.org verification scoped to the mapped five
  clubs; unmapped PL20 clubs return a clear unsupported-verification error.
- Added `fc25:fc26-pl20-baseline` harness and tests.
- Ran the full PL20 baseline: 380 directional fixtures × 25 seeds = 9,500 runs.

## Measurement

Raw report: `packages/match-engine/artifacts/calibration-pl20-fc26.json`

| Metric | PL20 mean | SE |
|---|---:|---:|
| Shots/match | 10.42 | 0.04 |
| Goals/match | 1.65 | 0.01 |
| Fouls/match | 4.09 | 0.02 |
| Cards/match | 1.00 | 0.01 |
| Corners/match | 2.00 | 0.01 |

Conclusion: complete PL20 ingestion does not explain away the low event-volume
finding. It confirms Phase 13's mechanism diagnosis should feed Phase 14.

## Queued Next

1. Phase 14 event-volume tuning against the PL20 baseline.
2. Add football-data.org mappings for all 20 clubs before broadening Squad
   Manager verification UX.
3. Later, consider FC26-rich fields for engine improvements:
   `position_ratings_json`, traits/tags, work-rate, and body data.

## Verification This Session

- `pnpm --filter @the-ataturk/data typecheck` passed.
- `pnpm --filter @the-ataturk/data test` passed.
- `pnpm --filter @the-ataturk/server typecheck` passed.
- `pnpm --filter @the-ataturk/server test` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
