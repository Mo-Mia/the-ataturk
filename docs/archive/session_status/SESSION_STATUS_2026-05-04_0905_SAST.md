# Session Status — 2026-05-04 09:05 SAST

## Where The Project Stands

FootSim is now a mature deterministic football simulation workbench. It has
real-squad ingestion, formation-aware and manual XIs, full 90-minute runs,
fatigue, substitutions, score-state urgency, chance creation, taker-aware set
pieces, true half-time side-switch, persisted run history, comparison views,
batch distribution analysis, and a locked calibration baseline against FC25
data.

The admin surface also exists now. Squad Manager at `/admin/squad-manager`
verifies squads against football-data.org, uses Gemini for structured
reconciliation, and applies accepted suggestions by creating immutable dataset
versions. FC26 data has been imported as the active dataset, preserving richer
metadata for future calibrated work without changing match-engine behaviour.

## Repo State

- Branch: `main`.
- Last commit before this close-out: `fdcc2ff docs: record fc26 ingestion follow-ups`.
- Close-out commit: this commit, `docs: end-of-session housekeeping and status doc`.
- Worktree at audit start: clean except Mo's new `docs/design/STYLE_GUIDE.md`,
  which is included in the close-out commit.
- Worktree after close-out commit: clean.
- Dev stack: server `http://127.0.0.1:8005`, web
  `http://127.0.0.1:5175`.
- Key local routes: `/visualise`, `/visualise/run`, `/visualise/compare`,
  `/visualise/batch/:batchId`, `/admin`, `/admin/squad-manager`.

## What Landed This Session

- Phase 1 — FC25 data and sim-runner workbench:
  `923bf65` through `f65a553`. Added FC25 parsing/import, v2 player adaptation,
  server simulation endpoint, and `/visualise/run`.
- Phase 2 — persistence, comparison, distribution:
  `0569a7e` through `2464309`. Persisted match-engine runs, decomposed visualiser
  panels, added comparison and batch distribution views.
- Phase 3 — full 90-minute support and formation-aware XI:
  `c4a9fcb` through `487c945`. Added half-time/full-time markers,
  full-match characterisation, formation-aware FC25 XI selection, and duration
  diagnostics.
- Phase 4 — manual XI, bench foundation, responsiveness:
  `839da11` through `4ec3c0f`. Added squad endpoints, manual XI picker,
  run-history filters, lineup diagnostics, and real-squad responsiveness
  harness.
- Phase 5 — in-match dynamics:
  `99e7866` through `97695d9`. Added fatigue, substitutions, score-state
  urgency, Auto Subs controls, responsiveness diagnostics, and baseline docs.
- Phase 6 — chance creation and set pieces:
  `2a08007` through `cf723ab`. Added chance creation, taker-aware set pieces,
  workbench summaries, scenario tests, and Phase 6 baselines.
- Phase 7 — true half-time side-switch:
  `a818f0f` through `1c3c297`. Audited direction surfaces, implemented
  side-switch, preserved old replay rendering, and refreshed status docs.
- Phase 8 paused — calibration consolidation:
  paused after baseline lock work exposed manual XI variance concerns.
- Phase 9 — manual XI investigation:
  `6033d09` and `e3fb429`. Proved the apparent manual XI decay was sample noise
  with 1000 paired seeds; locked the `-15.93%` FC25-specific result.
- Phase 8 resumed — calibration consolidation:
  `e0305b3` through `fca2864`. Locked `CALIBRATION_BASELINE_PHASE_8.md`, added
  `CALIBRATION_REFERENCE.md`, and backfilled representative sensitivity tests.
- Phase 10 — chance-creation isolated-toggle investigation:
  `5ed4f38` and `f8a4454`. Confirmed low ordinary-match isolated effect but
  strong forced-deficit composition effect.
- Squad Manager:
  `b2dca25` through `57ba9a3`. Added immutable apply-suggestion data flow,
  verification routes, admin UI, football-data.org/Gemini resilience fixes, and
  improved verification review UX.
- FC26 ingestion:
  `fe64393` through `fdcc2ff`. Added `--format fc25|fc26|auto`, preserved FC26
  metadata, lifted the 25-player cap, imported full squads, and documented
  follow-up engine candidates.

## Open BACKLOG Items

Engine fidelity:
- Commentary foundation remains the most important deferred feature from the
  original Phase 5 candidate list.
- Chance creation outside chase contexts may need richer open-play texture if
  UAT finds ordinary possession too flat.
- Player Manager protagonist tuning still needs integration-specific design.

Workbench polish:
- Complete `VisualiserPage.tsx` decomposition when richer replay controls force
  it.
- Manual line-up presets and drag-and-drop UX remain deferred.

Admin tooling:
- Squad Manager shipped; it was previously open in BACKLOG and is now closed.
  See `docs/DECISIONS.md` and commits `b2dca25`, `93f5496`, `38d6988`,
  `51c000e`.
- Persistent football-data.org cache, manual cache invalidation, dataset-version
  diff visualisation, rollback/version revert, drag-and-drop XI editing,
  arbitrary player editing, mobile responsiveness, bulk verify, and suggestion
  history remain open.

Investigation follow-ups:
- Penalty frequency in real-squad matchups needs re-checking once more matchup
  variety or referee variance exists.
- High-variance personnel and composition experiments should use 1000 paired
  seeds before firm conclusions.

FC26 follow-ups:
- Re-run characterisation plus responsiveness against the FC26 active dataset,
  document baseline numbers, and decide whether drift warrants tuning.
- Use `position_ratings_json` for XI and bench fit.
- Derive defensible `PlayerOverrides` from FC26 traits/tags.
- Evaluate work-rate, body data, height, weight, and goalkeeper speed in a
  calibrated engine sprint.

Deferred features:
- Injuries, referee personality, weather/venue effects, detailed set-piece
  routines, aerial-duel depth, goalkeeper distribution nuance, morale/composure,
  chemistry/form/familiarity, tactical flank asymmetry, and campaign persistence.

## Dataset Version Implications

Old persisted match runs reference FC25 player IDs. Some FC25 Liverpool players
are no longer Liverpool players in FC26, including Mohamed Salah and
Trent Alexander-Arnold. Comparison view across pre/post-FC26-active runs will
therefore show different rosters. That is correct but visually surprising.

`docs/CALIBRATION_BASELINE_PHASE_8.md` was established against FC25 squads.
Running characterisation against FC26-active squads will produce different
numbers. If calibration validation is needed against FC26, it is a new run and
new baseline, not a comparison to the locked Phase 8 FC25 baseline.

Phase 9 manual XI investigation used FC25 Liverpool. Re-running against FC26
Liverpool would have different rotation candidates, with Wirtz now in the squad
and Salah out. The `-15.93%` manual XI baseline is FC25-specific.

Phase 4-7 responsiveness experiments all used FC25 data. The harness is
reusable, but those numeric baselines are anchored to FC25. None of these are
problems requiring action. They are context so the next SA session does not
accidentally compare FC25-baseline numbers against FC26-run results.

## What's Queued For Next Session

1. UAT is overdue and should be the first next-session decision unless Mo
   deliberately prioritises another sprint.
2. Commentary foundation remains the original deferred Phase 5 candidate and is
   the next major product-facing layer.
3. If calibration validation against FC26 is desired, treat it as a discrete
   sprint: run characterisation and responsiveness against FC26-active, document
   the numbers, and decide whether drift warrants tuning.
4. Squad Manager follow-up can continue after UAT: persistent cache, diff
   visualisation, rollback, and richer player editing are the likely next
   admin decisions.

## Operating Notes For Next-Session Mo Or SA

- High-variance experiments need 1000-seed paired-seed analysis. Phase 9 showed
  that 200-seed personnel conclusions can look directionally wrong.
- Composition is multiplicative, not additive. Phase 6/10 showed chance
  creation matters most when score-state creates the late-chase context.
- Strict refactors with provable equivalence are tractable. Phase 7 showed the
  side-switch refactor could land safely with compatibility and audit coverage.
- Calibration baselines are dataset-version-specific. FC26 active is correct,
  but FC25 baseline numbers remain FC25 baseline numbers.
- Format detection by headers needs an escape hatch. The importer now has
  `--format fc25|fc26|auto`, with `auto` as the default.
- Import warnings on club squads above 35 players are non-fatal. They surface
  dataset weirdness early, the same class of surprise as the Phase 4 Liverpool
  fixture cap issue.

## Verification

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `git status` before commit showed only the intended documentation changes and
  Mo's new `docs/design/STYLE_GUIDE.md`.
