# Session Status — FootSim Phase 4 Manual XI + Real-Squad Review

Last updated: 2026-05-03 11:03 SAST

## Executive Summary

FootSim Phase 4 is implemented and verified at package level. The workbench can
now run real FC25 squads with either automatic formation-aware XIs or manual
starting XIs selected from the squad list. Run history has basic filters, and
the real-squad responsiveness harness confirms that tactics, formation, and
manual XI choices move match outcomes without changing engine internals.

The match engine package remained frozen in this sprint.

## Commits In This Sprint

- `839da11 feat(data): add manual lineup selection and bench metadata`
  - Added `selectLineup`.
  - Preserved `selectStartingXI` compatibility.
  - Added manual-XI validation: exactly 11 players, unique IDs, all in squad,
    one goalkeeper.
  - Added deterministic bench metadata and out-of-position warnings.

- `973e327 feat(server): support squad endpoint and manual starting XIs`
  - Added `GET /api/match-engine/clubs/:clubId/squad`.
  - `POST /api/match-engine/simulate` accepts optional `startingPlayerIds`.
  - Persisted `xiSelection` and `bench` in run summaries.

- `3a02960 feat(web): add manual XI picker to sim runner`
  - Added the squad-list starter toggle UI.
  - Added "Auto-fill remainder" and "Reset to auto XI".
  - Inline validation blocks invalid manual XIs before simulation.
  - Run history expansion shows XI mode and bench.

- `716b671 feat(server): add match-run filtering`
  - Added `GET /api/match-engine/runs` filters for club, duration, formation,
    batch ID, seed, and date range.

- `7d002b3 feat(web): add run-history filters and lineup diagnostics`
  - Added filter controls to `/visualise/run`.
  - Added line-up diagnostics in the workbench run history.

- `cb08f9c test(data): add real-squad responsiveness harness`
  - Added `pnpm --filter @the-ataturk/data fc25:responsiveness`.
  - Added a repeatable manual-XI rotation test.
  - Added a 50-seed real-squad responsiveness report path.

## Current Capabilities

- Workbench URL: `/visualise/run`.
- Five FC25 clubs remain the current Phase 1 whitelist.
- Default runs are full 90-minute simulations.
- Automatic XIs are still selected by formation by default.
- Manual XI mode is available per side through starter toggles.
- Auto-fill behaviour: currently selected manual starters stay locked; empty
  starter slots are filled by the current selector/highest-overall remaining
  squad players; role assignment is then calculated over the combined XI.
- Run summaries preserve XI, bench, line-up mode, and warnings.
- Run history can be filtered without refreshing the page.

## Real-Squad Responsiveness

Harness command:

```bash
pnpm --filter @the-ataturk/data fc25:responsiveness -- --csv data/fc-25/male_players.csv --seeds 50
```

Results:

- Mentality: Liverpool defensive → attacking moved Liverpool shots
  `3.16 -> 8.62` (+172.78%), PASS.
- Pressing: Liverpool low → high moved Liverpool fouls `1.24 -> 4.48`
  (+261.29%), PASS.
- Tempo: Liverpool slow → fast moved Liverpool possession streak
  `3.44 -> 2.86` (-16.67%), PASS. Direction is football-correct: faster tempo
  shortens possession.
- Manual XI rotation: Liverpool automatic XI → rotated XI moved Liverpool
  goals `0.98 -> 0.80` (-18.37%), PASS.
- Formation diagnostic: Liverpool `4-3-3` produced +247.19% wide deliveries
  versus Liverpool `4-4-2`.

The manual-XI rotation is repeatable: automatic Liverpool `4-3-3`, remove Van
Dijk, Salah, and Alexander-Arnold, then add Chiesa, Gakpo, and Núñez.

Full report: `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md`.

## Known Deferrals

- Manual bench selection.
- Drag-and-drop XI builder.
- Saved line-up presets.
- Production substitutions API/UI.
- SQL-backed advanced run-history filtering if history volume grows.
- True half-time side-switch.
- Fatigue, score-state behaviour, and chemistry/familiarity modelling.

## Verification So Far

- `pnpm --filter @the-ataturk/data test` — passed
- `pnpm --filter @the-ataturk/data typecheck` — passed
- `pnpm --filter @the-ataturk/server test` — passed
- `pnpm --filter @the-ataturk/server typecheck` — passed
- `pnpm --filter @the-ataturk/web test` — passed
- `pnpm --filter @the-ataturk/web typecheck` — passed
- `pnpm --filter @the-ataturk/data fc25:responsiveness -- --csv data/fc-25/male_players.csv --seeds 50` — passed

Final close-out still needs root-level:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`

## Next Suggested Decision

FootSim is now mature enough for another UAT pass focused on manual line-ups,
formation changes, and full-match real-squad texture. The next planning
decision should be whether to add production substitutions/fatigue, true
half-time side-switching, or commentary/analyst tooling before resuming
Atatürk integration.
