# Session Status — Match Engine Post-v2 Refinement And Responsiveness Gate

Last updated: 2026-05-01 16:30 SAST

## Executive Summary

Since the v2 attribute bridge sprint shipped, the standalone TypeScript match engine has moved through several UAT-driven refinement loops and then cleared the responsiveness gate. The engine remains independent from the old `footballsimulationengine` path and The Atatürk's existing `/match` route.

Current state: the engine is watchable, deterministic, calibrated on both v1 and v2 input paths, instrumented for visual/statistical UAT, and responsive to tactical and player-quality changes. The 100-seed v2 stress test reduced the previous `0-3` score-share watch item from 40% to 33%, giving distribution headroom. One final diagnostic UAT pass is being prepared before Atatürk integration planning is locked.

## Baseline At Last Senior Architect Report

The last Senior Architect handoff covered the v2 attribute bridge sprint and immediate clean-up:

- `1144318` — v2 attribute bridge types
- `b6e82c3` — accept v2 match configs at engine boundary
- `42defcc` — weak-foot shot modifiers
- `8bce44b` — v2 characterisation tests
- `fc3d434` — calibration follow-ups in `DECISIONS.md` / `BACKLOG.md`
- `6ea319a` — documentation refresh
- `807c46c` — cleanup of stale FSE snapshot bridge

This document covers the work after `807c46c`.

## Post-v2 Commits Completed

- `5519871 feat(match-engine): add full-time event and reduce striker passing loops`
  - Added a final whistle / `full_time` event at 90:00.
  - Reduced repetitive striker-to-striker pass loops.
  - Visualiser renders full-time events.

- `6c26fe7 fix(match-engine): harden second-yellow send-offs`
  - Centralised booking logic.
  - Second yellow now immediately emits a red event and removes the player from the pitch.
  - Added invariant tests so twice-booked players cannot remain active.
  - Visualiser marks second bookings.

- `e4ed743 feat(match-engine): add wide carrier behaviour`
  - Wide carriers are more likely to carry/hold instead of instantly bouncing the ball inside.
  - Added same-flank support preference.

- `b4ec5cc feat(match-engine): add attacking wide deliveries`
  - Added `carry` semantic events.
  - Added `cutback` pass type.
  - Wide final-third carriers can deliver crosses/cutbacks.
  - Visualiser renders carry detail.

- `7546dda feat(match-engine): trigger deliveries after wide carries`
  - Added short-lived `lastWideCarryTick` context.
  - Post-carry wide pass selection strongly prefers central attacking runners.
  - Fixed the UAT issue where wide carries never produced crosses/cutbacks.

- `e617667 feat(match-engine): add ball-side off-ball shifting`
  - Added ball-side lateral shifting.
  - Far-side wide players tuck inward.
  - Near-side wide players and full-backs make forward/overlap target runs.
  - Fixed the rigid touchline issue without reintroducing swarming.

- `595cfde test(match-engine): add forced second-yellow replay scenario`
  - Extracted snapshot serialisation into `src/snapshot.ts`.
  - Added a forced second-yellow replay script and artefact.
  - Generated `forced-second-yellow-v2.json(.gz)` for UAT.

- `cce7d2a feat(match-engine): add attacking momentum support runs`
  - Added internal attack-flow momentum and possession streak state.
  - Movement now lets selected midfielders/full-backs support beyond halfway when momentum and pitch progress justify it.
  - Centre-backs and deeper midfielders remain conservative.
  - Momentum affects movement only, not shot/goal probability tables.

- `8d329a3 feat(web): add visualiser heatmap diagnostics`
  - Added Replay / Heatmap toggle to `/visualise`.
  - Added possession filter: all/home/away.
  - Added ball-position heatmap and diagnostics:
    - attacking-third percentage
    - central-lane percentage
    - left/right flank percentage
    - average ball Y by team

- `d4200a6 feat(match-engine): expose momentum diagnostics`
  - Added `attackMomentum` and `possessionStreak` to each snapshot tick.
  - Added a live momentum/streak overlay to the visualiser heatmap diagnostic view.
  - Regenerated the v2 representative snapshot and captured a visualiser screenshot.

- `ebcedd5 test(match-engine): add responsiveness harness`
  - Added a deterministic responsiveness harness for tactic and player-impact experiments.
  - Added the test-only `__testApplyMidMatchAttributeSwap` mechanism for scripted 60-minute substitution-style checks.
  - Added 100-seed v2 stress reporting.
  - Added report-only weak-foot compounding comparison without changing committed mechanics.

Pre-UAT diagnostic sprint now in progress:

- Snapshot ticks include derived team-shape diagnostics:
  - active players
  - line heights
  - width/depth/compactness
  - thirds occupation
  - opposition-half players
  - ball-side players
- Visualiser heatmap mode can show ball, home-player, away-player, or all-player heatmaps.
- Added model-gap audit: `docs/MATCH_ENGINE_MODEL_GAPS.md`.
- Added UAT handoff: `docs/UAT_HANDOFF_2026-05-01_PRE_INTEGRATION.md`.
- Added forced scenario artefacts:
  - `forced-early-goal-v2.json(.gz)`
  - `forced-high-momentum-attack-v2.json(.gz)`

## UAT Findings And Fixes Since v2 Bridge

### Confirmed Fixed

- Goal state machine:
  - Goal events now pause play, reset the ball to centre, migrate players back to formation positions, and restart with the conceding team kicking off.
  - Visualiser displays a prominent goal overlay.

- Full-time state:
  - Engine now emits a `full_time` event at 90:00.
  - Visualiser event log displays final score detail.

- Double-yellow send-offs:
  - Forced UAT artefact verified:
    - first yellow at 51:00
    - second yellow + red at 51:36
    - player removed immediately
    - team continues with 10 players without shape/state breakage

- Wide play:
  - Wide players carry the ball, and carry events are visible in the event log.
  - Wide carries trigger crosses/cutbacks instead of sterile central recycling.

- Anti-swarming / shape:
  - Severe central swarming was fixed.
  - Later ball-side shifting removed the opposite extreme where players stayed glued to fixed lanes.

- Vertical support:
  - Attack momentum now lets selected midfielders/full-backs cross halfway and support attacks when the team has built enough pressure.
  - Momentum is visible in snapshots and the heatmap diagnostic overlay.

- Stats-panel confidence:
  - UAT report initially suspected card-count drift, but JSON ground-truth review showed the panel matched engine state in later runs.

## Responsiveness Gate Results

All pre-declared responsiveness thresholds passed. Each tactical test varied one Liverpool variable only while Milan stayed at balanced/medium/normal baseline.

| Test | Metric | Result | Threshold | Status |
|---|---:|---:|---:|---|
| Mentality: attacking vs defensive | Liverpool shots | `1.24 -> 3.12` (`+151.61%`) | >=30% | Pass |
| Pressing: high vs low | Liverpool fouls | `0.82 -> 2.30` (`+180.49%`) | >=20% | Pass |
| Tempo: fast vs slow | Liverpool possession-streak length | `3.42 -> 2.88` (`-15.80%`) | >=15% magnitude | Pass |
| Single-player +15 attribute boost | Liverpool goals | `0.14 -> 0.36` (`+157.14%`) | >=25% | Pass |
| Test-only 60-minute attribute swap | >=2 post-60 metrics | 4 metrics moved >=10% | >=2 metrics | Pass |

Notes:

- Tempo moves in the football-correct direction: fast tempo shortens possession streaks because risk and turnovers rise; slow tempo extends them through patient possession.
- The single-player boost used Smicer, a mid-attribute outfield player with enough headroom. Shot volume moved only slightly (`1.82 -> 1.92`, `+5.49%`), but conversion improved enough to validate player-quality impact.
- The scripted 60-minute swap is deliberately test-only and named `__testApplyMidMatchAttributeSwap`; it is not a public substitution API.

## Latest Characterisation And Stress Tests

### v1 50-seed calibration

- Shots: `9.00` target `[8, 12]`
- Goals: `1.54` target `[1, 3]`
- Fouls: `5.38` target `[4, 8]`
- Cards: `1.44` target `[1, 3]`
- Calibration pass: yes

### v2 rated preferred-foot 50-seed calibration

- Shots: `8.28` target `[8, 12]`
- Goals: `1.00` target `[1, 3]`
- Fouls: `5.20` target `[4, 8]`
- Cards: `1.16` target `[1, 3]`
- Calibration pass: yes
- Note: earlier 50-seed `0-3` share appeared exactly at the 40% ceiling.

### v2 rated preferred-foot 100-seed stress test

- Shots: `8.02` target `[8, 12]`
- Goals: `1.18` target `[1, 3]`
- Fouls: `5.12` target `[4, 8]`
- Cards: `1.33` target `[1, 3]`
- Maximum final-score share: `33%` (`0-3`, 33/100), pass against <=40% rule
- Top final scores:
  - `0-3`: 33
  - `1-3`: 17
  - `0-4`: 15
  - `1-4`: 10
  - `2-3`: 9

### Weak-foot compounding experiment

- Baseline v2 50-seed goals: `1.00`, `0-3` share `40%`
- Temporary experiment, weak-foot multiplier applied to on-target only: goals `1.06`, `0-3` share `36%`
- Conclusion: change is measurable but modest; not enough to justify changing weak-foot mechanics in this sprint.
- The experiment was reverted before commit.

## Current Representative Artefacts

- `packages/match-engine/artifacts/representative-seed-1-v2.json`
- `packages/match-engine/artifacts/representative-seed-1-v2.json.gz`
- `packages/match-engine/artifacts/responsiveness-report.json`
- `packages/match-engine/artifacts/visualiser-momentum-heatmap.png`
- `packages/match-engine/artifacts/forced-early-goal-v2.json`
- `packages/match-engine/artifacts/forced-early-goal-v2.json.gz`
- `packages/match-engine/artifacts/forced-high-momentum-attack-v2.json`
- `packages/match-engine/artifacts/forced-high-momentum-attack-v2.json.gz`
- `packages/match-engine/artifacts/forced-second-yellow-v2.json`
- `packages/match-engine/artifacts/forced-second-yellow-v2.json.gz`

Latest representative seed summary:

- Final score: LIV 1-5 MIL
- Shots: 9 total, LIV 4 / MIL 5
- Fouls: 4 total, LIV 3 / MIL 1
- Cards: 3 total, LIV 2 / MIL 1
- Carries: 29
- Crosses: 6
- Cutbacks: 4
- Tick diagnostics include `attackMomentum`, `possessionStreak`, and team-shape diagnostics.

Forced early-goal artefact summary:

- Final score: LIV 1-4 MIL
- Forced goal: LIV `home-9`, 48:00
- Restart: MIL kick-off, 48:15
- Purpose: inspect goal overlay, reset, momentum/streak reset, and shape recovery.

Forced high-momentum artefact summary:

- Final score: LIV 1-4 MIL
- Max LIV momentum: 87
- High-momentum support ticks: 38
- Purpose: inspect midfield/full-back support beyond halfway without swarming.

Forced second-yellow artefact summary:

- Final score: LIV 0-3 MIL
- First yellow: MIL `away-6`, 51:00
- Second yellow: MIL `away-6`, 51:36
- Red: MIL `away-6`, 51:36, `reason: second_yellow`
- Player remains off pitch after dismissal.

## Verification Status

Latest verification after pre-UAT diagnostic work:

- `pnpm test` — passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed
- `pnpm --filter @the-ataturk/match-engine responsiveness` — passed
- `pnpm --filter @the-ataturk/match-engine characterise -- --seeds 100 --schema v2 --preferred-foot rated` — passed during responsiveness close-out
- `pnpm --filter @the-ataturk/match-engine characterise -- --seeds 50 --schema v2 --preferred-foot rated` — passed after diagnostics, unchanged metrics
- No behaviour drift for seeds `1`, `17`, and `99` when comparing final score, stats, and event summaries while ignoring the new diagnostics field.

## Files Most Relevant For SA Review

Engine:

- `packages/match-engine/src/state/momentum.ts`
- `packages/match-engine/src/ticks/movement.ts`
- `packages/match-engine/src/ticks/runTick.ts`
- `packages/match-engine/src/resolution/actions/pass.ts`
- `packages/match-engine/src/resolution/actions/dribble.ts`
- `packages/match-engine/src/resolution/actions/tackle.ts`
- `packages/match-engine/src/snapshot.ts`
- `packages/match-engine/scripts/forcedSecondYellow.ts`
- `packages/match-engine/scripts/responsiveness.ts`

Tests:

- `packages/match-engine/test/state/momentum.test.ts`
- `packages/match-engine/test/ticks/runTick.test.ts`
- `packages/match-engine/test/resolution/carrierAction.test.ts`
- `packages/match-engine/test/resolution/pressure.test.ts`
- `packages/match-engine/test/integration/full_match.test.ts`
- `packages/match-engine/test/integration/responsiveness.test.ts`

Visualiser:

- `apps/web/src/match/visualiser/VisualiserPage.tsx`
- `apps/web/src/match/visualiser/__tests__/visualiser-page.test.tsx`

Canonical docs:

- `docs/ARCHITECTURE.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
- `docs/ENGINE_INTEGRATION_MAP.md`
- `docs/SESSION_STATUS_2026-04-30.md`
- this document

SA review zip:

- `docs/SA_REVIEW_match-engine-post-v2_2026-05-01_1506_SAST.zip`

## Recommended Next Sprint Focus

- Plan Atatürk integration of the standalone engine into the game-specific match loop.
- Define the real substitution API; do not reuse the responsiveness harness's test-only swap helper.
- Decide how Player Manager protagonist attributes should be tuned. The engine responds to a +15 Smicer boost, but the absolute goal lift (`+0.22` per second half across 50 seeds) may need targeted gameplay tuning to feel dramatic.
- Keep movement work stable unless UAT finds a specific problem. `movement.ts` is now complex enough that the next major movement feature should probably begin with a per-role movement strategy refactor.
- Revisit weak-foot compounding only if future calibration drift makes v2 goals fragile again.
- Re-run calibration when a real FC25-distributed v2 dataset lands.

## Explicit Non-goals / Boundaries Still Holding

- No integration of the new match engine into The Atatürk game-specific `/match` route yet.
- No DB schema changes.
- No changes to the old `footballsimulationengine` patch.
- No broad probability-table recalibration in the latest momentum/responsiveness work; behaviour changed through movement, diagnostics, and harness instrumentation.
