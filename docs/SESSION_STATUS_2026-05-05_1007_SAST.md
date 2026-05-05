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

The dashboard engine-character card surfaces the locked Phase 14b/17 values:

- Shots: `22.67` in `[19.4, 30.2]`
- Goals: `2.19` in `[1.16, 4.34]`
- Fouls: `17.47` in `[16.6, 26.6]`
- Cards: `5.10` in `[1.83, 5.87]`
- Corners: `7.01` in `[6.7, 13.2]`

## Likely Next Discussion

The logical next-step conversation should choose between:

- UAT agent readiness pass: make existing non-dashboard pages easier for agents
  to navigate and extract data from.
- Workbench UX polish pass: reduce friction now that navigation exists.
- Data/admin expansion: football-data.org mappings for all 20 PL clubs.
- Calibration/fidelity continuation: aerial/byline/goal-line corner texture,
  position ratings, work-rate, or tighter real-PL bands.
