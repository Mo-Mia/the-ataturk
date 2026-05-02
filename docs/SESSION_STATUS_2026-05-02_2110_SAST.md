# Session Status — FootSim Phase 2 Workbench Depth

Last updated: 2026-05-02 21:10 SAST

## Executive Summary

FootSim Phase 2 is implemented. The workbench has moved from a single-run
replay tool to a persistent research tool:

- `/visualise/run` now loads server-side persisted run history across refreshes.
- Every successful simulation writes a `match_runs` row in the existing Atatürk
  SQLite database.
- `/visualise/compare?a=<runId>&b=<runId>` compares two persisted runs
  side-by-side.
- `/visualise/batch/:batchId` shows distribution histograms for a 50-seed batch,
  with bar click-through to a representative replay.

The match engine remains frozen for this sprint. No files under
`packages/match-engine/src` were changed.

## Commits In This Sprint

- `0569a7e docs: record FootSim phase 2 scope`
  - Recorded the Phase 2 scope and workflow change in `docs/DECISIONS.md`.
  - Captured server-backed `/visualise/run` history and lowest-seed histogram
    representative behaviour.

- `5ef2e87 feat(data): persist match-engine run history`
  - Added additive migration `packages/data/migrations/004_match_runs.sql`.
  - Added typed match-run CRUD/list helpers in `packages/data`.
  - Added migration and repository tests.

- `f874e09 feat(server): expose persisted match run endpoints`
  - `POST /api/match-engine/simulate` now persists one `match_runs` row per
    successful run.
  - Added:
    - `GET /api/match-engine/runs`
    - `GET /api/match-engine/runs/:id`
    - `GET /api/match-engine/batches/:batchId/runs`
    - `DELETE /api/match-engine/runs/:id`
  - List/detail endpoints filter missing artefact files.
  - Delete removes both row and artefact file and is idempotent.

- `013a87a refactor(web): lift visualiser stats panel`
  - Lifted reusable stats aggregation/display from `VisualiserPage.tsx`.
  - Existing `visualiser-page.test.tsx` stayed green.

- `0314082 refactor(web): lift visualiser heatmap diagnostics`
  - Lifted pitch markings, heatmap rendering, relative-player heatmaps,
    momentum diagnostics, and shape diagnostics.
  - Existing `visualiser-page.test.tsx` stayed green.

- `163d42d refactor(web): lift visualiser event dock`
  - Lifted rich event-log formatting and display into a reusable component.
  - Existing `visualiser-page.test.tsx` stayed green.

- `bed91d2 feat(web): add persisted run comparison view`
  - `/visualise/run` now uses persisted server history.
  - Added `/visualise/compare`.
  - Compare view renders two runs with stats, shared-scale ball heatmaps, shape
    diagnostics, event docks, a summary diff, and cross-matchup warning.

- `c11471f feat(web): add batch distribution analysis`
  - Added `recharts` to the web app.
  - Added `/visualise/batch/:batchId`.
  - Batch view renders histograms for goals, shots, home possession, fouls, and
    cards with summary mean/median/range.
  - Histogram bars open the lowest-seed representative replay for that bucket.

## Current Capabilities

### Persistence

- `match_runs` persists:
  - run id
  - created timestamp
  - batch id
  - seed
  - home/away club ids
  - home/away tactics JSON
  - summary JSON
  - artefact filename
- Single runs use `batch_id = null`.
- Batch runs share a server-generated `batch_id`.
- Orphaned rows are filtered out of list/detail/batch responses; no garbage
  collection is performed this sprint.

### API

- `GET /api/match-engine/runs?page=N&limit=N`
  - Newest-first list.
  - Page-based pagination.
  - Filters rows whose artefact file is missing.

- `GET /api/match-engine/runs/:id`
  - Returns one persisted run if the row and artefact both exist.

- `GET /api/match-engine/batches/:batchId/runs`
  - Returns all visible runs in a batch.

- `DELETE /api/match-engine/runs/:id`
  - Hard-deletes the row and artefact file.
  - Repeated deletes return 204.

### Web

- `/visualise/run`
  - Loads persisted recent runs from the server.
  - Newly simulated runs still appear immediately.
  - Keeps inline partial batch errors from Phase 1.
  - Links to replay, compare, and batch distribution where applicable.

- `/visualise/compare`
  - Requires two run ids for the full view.
  - Provides run pickers when ids are missing.
  - Warns on cross-matchup comparisons but still renders.
  - Uses shared heatmap colour scale between both columns.

- `/visualise/batch/:batchId`
  - Shows shape-inspection histograms only.
  - No regression analysis, hypothesis testing, or cross-batch comparison.
  - Bar click-through currently opens the lowest-seed representative run.

## Verification Status

Package-level verification run during the sprint:

- `pnpm --filter @the-ataturk/data test` — passed
- `pnpm --filter @the-ataturk/data typecheck` — passed
- `pnpm --filter @the-ataturk/server test` — passed
- `pnpm --filter @the-ataturk/server typecheck` — passed
- `pnpm --filter @the-ataturk/web test -- visualiser-page.test.tsx StatsPanel.test.tsx` — passed
- `pnpm --filter @the-ataturk/web test -- visualiser-page.test.tsx HeatmapPanel.test.tsx` — passed
- `pnpm --filter @the-ataturk/web test -- visualiser-page.test.tsx EventDock.test.tsx` — passed
- `pnpm --filter @the-ataturk/web test -- sim-runner-page.test.tsx compare-page.test.tsx visualiser-page.test.tsx` — passed
- `pnpm --filter @the-ataturk/web test -- batch-distribution-page.test.tsx compare-page.test.tsx visualiser-page.test.tsx` — passed
- `pnpm --filter @the-ataturk/web typecheck` — passed after each web lift/feature commit

Full repo verification is the final close-out step after this docs commit:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`

## Tests Added Or Extended

- `packages/data/test/match-runs.test.ts`
- `server/test/match-engine/simulate-route.test.ts`
  - simulate persistence
  - consistent batch id across 50 runs
  - list pagination/newest-first/orphan filtering
  - detail and batch 404s
  - delete removes file and row
  - repeated delete is idempotent
- `apps/web/src/match/visualiser/components/__tests__/StatsPanel.test.tsx`
- `apps/web/src/match/visualiser/components/__tests__/HeatmapPanel.test.tsx`
- `apps/web/src/match/visualiser/components/__tests__/EventDock.test.tsx`
- `apps/web/src/match/visualiser/__tests__/compare-page.test.tsx`
- `apps/web/src/match/visualiser/__tests__/batch-distribution-page.test.tsx`
- `apps/web/src/match/visualiser/__tests__/sim-runner-page.test.tsx`
  - updated for persisted history and partial batch errors

## Deferred Items Now Tracked

- Run history filtering/search by team, date range, tactics, and seed range.
- Run history eviction policy.
- Run notes/annotations.
- N-way comparison.
- Synchronised event-timeline scrubbing.
- Cross-batch distribution comparison.
- Cursor pagination if run history grows beyond a few thousand rows.
- Histogram bar tie-breaking picker; currently lowest-seed representative.
- Complete `VisualiserPage.tsx` decomposition; Phase 2 partially addressed it
  but did not finish the route split.

## Important Boundaries Still Holding

- The old `/match` route still uses the legacy `footballsimulationengine` path.
- No `packages/match-engine/src` changes in Phase 2.
- No SSE streaming.
- No Atatürk production integration of the custom engine yet.
- No run-history eviction or orphan garbage collection.
- No N-way comparison or cross-batch analytics.

## Next Suggested Sprint

Use the now-persistent workbench to run comparative UAT:

1. Import the five-club FC25 fixture or full CSV.
2. Run baseline 50-seed batches for the most important matchups.
3. Compare representative high/low/median runs side-by-side.
4. Use `/visualise/batch/:batchId` to inspect whether distributions match
   visual UAT impressions.
5. Decide whether the next sprint is Atatürk integration planning, commentary
   vocabulary, or another workbench-analysis increment.
