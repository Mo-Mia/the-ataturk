# Session Status — 2026-05-05 10:07 SAST

## Current State

FootSim is immediately post Phase 17 and post workbench UI consolidation.
Phase 14b/17 is the active calibration baseline; Phase 8 is retired as the
active anchor and preserved as historical context.

The workbench now has:

- Persistent navigation across dashboard, Sim Runner, Snapshot Replay, Compare,
  Latest Batch, and Squad Manager routes.
- A read-only dashboard at `/`.
- The legacy smoke-test surface preserved at `/smoke-test`.
- Stable UAT selectors and data attributes documented in
  `docs/UAT_WORKBENCH_DOM_CONTRACT.md`.
- A simple Vite-served favicon at `/favicon.ico`.

## Latest Commits

- `8cc4a7b` — Add persistent workbench navigation
- `3c1c312` — Add workbench dashboard
- `2686dc5` — Document workbench UAT contract
- `1cc12c8` — Update workbench page title

Pending at this checkpoint: favicon/session-status commit and push.

## Verification

Passed:

- `pnpm --filter @the-ataturk/web test`
- `pnpm --filter @the-ataturk/web typecheck`
- Playwright smoke checks for `/`, `/visualise/run`, `/visualise`,
  `/visualise/compare`, `/admin/squad-manager`, and `/smoke-test`
- `/favicon.ico` generated as a two-size ICO (`32x32`, `16x16`)

Observed non-blocker:

- Browser still reports missing favicon only before the favicon commit lands.

## Product Notes

The dashboard and navigation sprint deliberately avoided redesigning existing
pages. Existing page styles remain heterogeneous. The sprint outcome is
observability and wayfinding, with future aesthetic coherence tracked in
`docs/BACKLOG.md`.

The active runtime dataset remains FC26 PL20:
`fc25-20260504102445-4399cb2b-a504ee92`.

Runtime DB checkpoint after the UAT/display-name readiness sprint:

- Active FC26 PL20 dataset `fc25-20260504102445-4399cb2b-a504ee92`
  has `source_name`, `source_short_name`, and `display_name` repaired from
  `data/fc-25/FC26_20250921.csv`.
- The display-name repair command is idempotent: the second repair pass matched
  547 players and updated 0 rows.
- Historical match artefacts are intentionally unchanged; only newly generated
  runs include improved display-name metadata in persisted XI/bench summaries
  and snapshot rosters.

PL20 Admin Expansion checkpoint:

- Squad Manager football-data.org mappings now cover all 20 active FC26 Premier
  League clubs.
- Live verification command:
  `pnpm --filter @the-ataturk/server football-data:verify-pl20`.
- Live result against active dataset
  `fc25-20260504102445-4399cb2b-a504ee92`: `20/20` clubs succeeded, `0`
  failed.
- The verification pass generated suggestions for review only; no suggestions
  were applied and no dataset version was created.
- Final football-data.org quota reported by the command: `9` minute remaining,
  `80` day remaining.

The dashboard engine-character card surfaces the locked Phase 14b/17 values:

- Shots: `22.67` in `[19.4, 30.2]`
- Goals: `2.19` in `[1.16, 4.34]`
- Fouls: `17.47` in `[16.6, 26.6]`
- Cards: `5.10` in `[1.83, 5.87]`
- Corners: `7.01` in `[6.7, 13.2]`

## Likely Next Discussion

The logical next-step conversation should choose between:

- Workbench UX polish pass: reduce friction now that navigation exists.
- Squad Manager suggestion triage: decide whether any live PL20 verification
  suggestions should become accepted dataset changes.
- Admin infrastructure: persistent football-data.org cache, cache invalidation,
  diff visualisation, rollback, or XI movement.
- Calibration/fidelity continuation: aerial/byline/goal-line corner texture,
  position ratings, work-rate, or tighter real-PL bands.

## Completed After This

**PL20 Admin Expansion** is complete. It added football-data.org mappings for
all 20 FC26 Premier League clubs, verified route/API coverage for the expanded
mappings, and proved Squad Manager verification works across the full PL20
dataset.

**Squad Manager Suggestion Triage Sprint** is complete in review-only mode.
The reusable command is
`pnpm --filter @the-ataturk/server football-data:triage-sample`; it sampled
`liverpool`, `sunderland`, and `manchester-united` against active dataset
`fc25-20260504102445-4399cb2b-a504ee92`.

Report snapshot:

- `docs/SQUAD_MANAGER_TRIAGE_PL20_SAMPLE_2026-05-05.md`
- `docs/SQUAD_MANAGER_TRIAGE_PL20_SAMPLE_2026-05-05.json`

Live result: `3/3` sampled clubs succeeded, `118` total suggestions were
captured, with risk counts `70` low, `12` medium, and `36` high. The active
dataset id remained `fc25-20260504102445-4399cb2b-a504ee92`, dataset-version
count remained `3`, no suggestions were applied, and no dataset version was
created or activated.
