# Session Status — FootSim Phase 1 Workbench Slice

Last updated: 2026-05-02 19:45 SAST

## Executive Summary

FootSim Phase 1 is implemented as a vertical slice: real FC25 data ingestion,
server-side batch simulation, workbench UI, and direct replay in the existing
snapshot visualiser. The standalone match engine remains frozen for this sprint;
the new work consumes its existing v2 input boundary.

The result: Mo can import the five approved Premier League clubs, open
`/visualise/run`, choose two real FC25 squads, configure the six engine tactics
per side, run one or fifty second-half simulations, and click any result into
`/visualise?artifact=...` for replay.

This sprint still does **second-half-only** matches: `duration: "second_half"`,
900 ticks, 0-0 start. Full 90-minute FootSim support is deferred and will need
its own calibration pass.

## Commits Since Previous Status

FootSim Phase 1:

- `923bf65 docs: record FootSim phase 1 scope and FC25 mapping`
  - Added `docs/FC25_DATA_MAPPING.md`.
  - Recorded the five-club scope, FC25 CSV mapping, tactics shape, supported
    formation options, and formation-neutral starter-XI compromise.

- `de66988 feat(data): add FC25 schema parser and types`
  - Added additive `fc25_*` SQLite tables.
  - Added typed FC25 parser support using `csv-parse`.
  - Added five-club constants for Arsenal, Manchester City, Manchester United,
    Liverpool, and Aston Villa.

- `1ac2bb1 feat(data): adapt FC25 rows to engine v2 players`
  - Added tracked fixture `data/fc-25/fixtures/male_players_top5pl.csv`.
  - Kept full source CSV files ignored under `data/fc-25/*.csv`.
  - Added FC25 row -> `PlayerInputV2` adapter and five golden tests:
    Martin Odegaard, Rodri, Bruno Fernandes, Alisson, and Emiliano Martinez.

- `ffd7986 feat(data): add FC25 import service and CLI`
  - Added `pnpm --filter @the-ataturk/data fc25:import`.
  - Imports create new dataset versions and activate only after success.
  - Added `loadFc25Squad`, `listFc25Clubs`, and active-version helpers.
  - Starter XIs are formation-neutral and locked at ingest for this sprint.

- `a0e8969 feat(server): add match-engine simulation endpoint`
  - Added `GET /api/match-engine/clubs`.
  - Added `POST /api/match-engine/simulate`.
  - Batch simulation runs serially, capped at 50, writes artefacts server-side,
    and returns partial successes plus per-seed error metadata.
  - Artefact filenames include timestamp, teams, seed, and short hash suffix to
    avoid collisions.

- `3eea572 feat(web): add FC25 sim runner workbench`
  - Added `/visualise/run` as a sibling route, leaving `VisualiserPage.tsx`
    intact.
  - Added two team pickers, six tactical levers per side, seed input, batch
    selector, loading/error states, and in-memory run history.
  - Partial batch errors render inline alongside successful result rows.

- `1854800 feat(web): allow visualiser artifact query loading`
  - Added approved `?artifact=` auto-load support to `/visualise`.
  - The sim runner links directly to `/visualise?artifact=<filename>`.

## Current Capabilities

### FC25 Data Layer

- SQLite migration: `packages/data/migrations/003_fc25.sql`.
- Import tables:
  - `fc25_dataset_versions`
  - `fc25_clubs`
  - `fc25_players`
  - `fc25_squads`
- Import source default: `data/fc-25/male_players.csv`.
- Portable fixture for tests: `data/fc-25/fixtures/male_players_top5pl.csv`.
- Import command:

```sh
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/male_players.csv
```

The fixture can also be imported for local smoke testing:

```sh
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/fixtures/male_players_top5pl.csv
```

### Server API

- `GET /api/match-engine/clubs`
  - Returns the five active FC25 clubs.
  - Returns `[]` with HTTP 200 if no FC25 dataset is active.

- `POST /api/match-engine/simulate`
  - Body: `{ home: { clubId, tactics }, away: { clubId, tactics }, seed, batch }`.
  - Runs second-half-only simulations with 0-0 starting score.
  - `batch` is `1` or `50` in the current UI, and capped at 50 server-side.
  - Response shape includes `runs` and `errors`; a failed seed does not abort
    the whole batch.
  - Writes snapshots through the existing visualiser artefact path.

### Web Workbench

- `/visualise/run`
  - Team selectors for the five imported FC25 clubs.
  - Tactic controls match `TeamTactics` exactly:
    - `formation`
    - `mentality`
    - `tempo`
    - `pressing`
    - `lineHeight`
    - `width`
  - Formation options exposed in sprint 1:
    - `4-4-2`
    - `4-3-1-2`
    - `4-3-3`
    - `4-2-3-1`
  - Recent run history is in-memory only and resets on refresh.
  - Clicking a result navigates to `/visualise?artifact=...`.

- `/visualise`
  - Existing replay, stats, events, shape diagnostics, heatmaps, and
    player-relative heatmaps remain available.
  - Can browse safe `.json` artefacts from `packages/match-engine/artifacts`.
  - Can now auto-load an artefact from the `artifact` query parameter.

## Verification Status

Latest full verification after commit 7:

- `pnpm --filter @the-ataturk/web typecheck` — passed
- `pnpm --filter @the-ataturk/web test` — passed
- `pnpm lint` — passed
- `pnpm typecheck` — passed
- `pnpm test` — passed

Package-level coverage added during this sprint:

- `packages/data/test/fc25/parser.test.ts`
- `packages/data/test/fc25/adapter.test.ts`
- `packages/data/test/fc25/importer.test.ts`
- `server/test/match-engine/simulate-route.test.ts`
- `apps/web/src/match/visualiser/__tests__/sim-runner-page.test.tsx`
- `apps/web/src/match/visualiser/__tests__/visualiser-page.test.tsx`

## Deferred Items Now Tracked

- Full 90-minute FootSim support requires a separate calibration pass.
- Formation-aware starter-XI selection is deferred; the current XI is
  formation-neutral and locked at ingest.
- Run-history persistence across page refresh is deferred; the UI uses
  in-memory React state.
- `VisualiserPage.tsx` decomposition is deferred; the file remains at the
  complexity ceiling and should be split before comparison/diff work.

## Important Boundaries Still Holding

- The old `/match` route still uses the legacy `footballsimulationengine` path.
- `packages/match-engine/src` was not changed in this sprint.
- `VisualiserPage.tsx` was not decomposed; only the approved `?artifact=`
  auto-load hook was added.
- No SSE streaming for the sim runner.
- No all-league browser or squad editor.
- No production Atatürk integration of the custom engine yet.

## Next Suggested Sprint

Run the workbench with real imported FC25 squads and capture UAT:

1. Confirm the five-club import works against the local full CSV.
2. Run Liverpool vs each of the other four clubs with baseline tactics.
3. Run one 50-batch tactical comparison through `/visualise/run`.
4. Replay selected artefacts through `/visualise?artifact=...`.
5. Decide whether the next step is Atatürk integration planning or one more
   FootSim workbench refinement pass.

