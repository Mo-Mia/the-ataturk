# Session Status — FootSim Phase 5 Close-Out + Documentation Housekeeping

Last updated: 2026-05-03 13:01 SAST

## Executive Summary

FootSim is now mature through Phase 5. The standalone match engine supports
full-90 FC25 workbench simulations with formation-aware/manual XIs, fatigue,
scheduled/manual substitutions, AI Auto Subs, and score-state urgency. The
research workbench has persisted runs, comparison, batch distribution,
heatmaps, line-up diagnostics, substitution controls, and replay diagnostics.

The legacy `/match` route remains untouched and still uses the old
`footballsimulationengine` wrapper. The custom engine remains independent until
The Atatürk integration is explicitly planned.

## Current Capabilities

- `/visualise` replays match-engine snapshots and exposes event, stat, shape,
  momentum, heatmap, and player-relative diagnostics.
- `/visualise/run` runs FC25 squad simulations using five whitelisted Premier
  League clubs: Arsenal, Manchester City, Manchester United, Liverpool, Aston
  Villa.
- Runs default to `duration: "full_90"` but second-half diagnostic runs remain
  available.
- Automatic XIs are formation-aware. Manual XI mode is available with starter
  toggles and "auto-fill remainder".
- Run summaries persist XI, bench, line-up mode, warnings, substitutions, final
  stamina, and score-state events.
- Run history is persisted in SQLite and supports filtering.
- `/visualise/compare` compares two persisted runs.
- `/visualise/batch/:batchId` shows distribution analysis for 50-seed batches.

## Phase 5 Engine Work

Commits:

- `99e7866 feat(match-engine): add in-match dynamics`
- `de7e53e feat(web): expose substitution controls`
- `36c97b8 test(data): add Phase 5 responsiveness diagnostics`
- `59a6b2b docs: record FootSim Phase 5 baselines`

Implemented:

- Fatigue/stamina model with action-cost drain and stamina-scaled movement,
  pressure, passing, tackling, dribbling, and shooting.
- V2 stamina consumed directly; v1 inputs use agility as a stamina surrogate
  and emit an engine-init diagnostic warning.
- Scheduled manual substitutions and AI Auto Subs.
- Five-sub cap per side, cooldown, fatigue/tactical sub reasons, active-player
  replacement, substitution events, and persisted substitution summaries.
- Score-state urgency multiplier for late/deficit contexts.
- Forced scenario artefacts/scripts for substitutions, fatigue impact, and late
  comeback diagnostics.

## Calibration Baselines

Characterisation defaults now match the workbench: fatigue on, score-state on,
Auto Subs on, v2 preferred-foot mode rated.

Second-half v2 rated, 50 seeds:

- Shots: `8.04` target `[8, 12]`
- Goals: `1.24` target `[1, 3]`
- Fouls: `5.38` target `[4, 8]`
- Cards: `1.44` target `[1, 3]`
- Result: PASS

Full-90 v2 rated, 50 seeds:

- Shots: `16.54` target `[16, 24]`
- Goals: `2.10` target `[2, 6]`
- Fouls: `9.86` target `[8, 16]`
- Cards: `2.70` target `[2, 6]`
- Result: PASS

The Auto Subs fatigue threshold is data-backed. A 200-seed stamina probe over
Liverpool vs Manchester City sampled active-player stamina from 70:00 onward
with Auto Subs off. The 25th percentile was `51`, so
`SUBSTITUTIONS.fatigueThreshold` is now `51`.

## Real-Squad Responsiveness

Command:

```bash
pnpm --filter @the-ataturk/data fc25:responsiveness -- --csv data/fc-25/male_players.csv --seeds 200
```

Results:

- Mentality: Liverpool defensive -> attacking moved Liverpool shots
  `3.56 -> 7.68` (+116.03%), PASS.
- Pressing: Liverpool low -> high moved Liverpool fouls `1.32 -> 4.18`
  (+216.67%), PASS.
- Tempo: Liverpool slow -> fast moved Liverpool possession streak
  `3.44 -> 2.84` (-17.40%), PASS.
- Manual XI rotation, Auto Subs off: Liverpool goals `0.83 -> 0.68`
  (-19.16%), PASS against revised 10% threshold.
- Fatigue: late action success `54.88% -> 52.54%` (-4.26%), PASS against
  empirical 4% threshold.
- Score-state urgency: final-15 urgency `1.06 -> 1.24` (+16.98%), PASS
  qualitatively.
- Auto Subs: 4.92 total subs/match, 2.11 home, 2.81 away, zero zero-sub
  matches, max 6 total subs in one match.

The score-state finding is deliberately documented as qualitative. Urgency
does increase risk-taking and changes action distribution, but it does not yet
raise final-15 shot volume. That is tracked as a Phase 6 modelling gap.

## Documentation Refreshed

This housekeeping pass updated current-state references in:

- `README.md`
- `docs/PROJECT_BRIEF.md`
- `docs/ARCHITECTURE.md`
- `docs/FC25_DATA_MAPPING.md`
- `docs/UAT_FOOTSIM_ANALYST_PROMPT.md`
- `docs/ROADMAP.md`
- `docs/BACKLOG.md`
- `docs/CHARACTERISATION_FULL_MATCH.md`
- `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md`
- `docs/MATCH_ENGINE_MODEL_GAPS.md`

Historical session-status documents remain historical and were not rewritten.

## Known Deferrals

- True half-time side-switch.
- Score-state chance creation: trailing teams need a mechanism for earlier or
  wider shot attempts, not just riskier passes.
- Live in-replay substitution control.
- Manual bench editor.
- Injuries and injury substitutions.
- Fatigue recovery across matches.
- Formation changes via substitutions.
- Commentary/TTS integration.
- The Atatürk-specific half-time integration layer.

## Verification

After Phase 5 implementation:

- `pnpm test` — passed
- `pnpm typecheck` — passed
- `pnpm lint` — passed

Documentation-only housekeeping will be committed separately after this file is
added and formatting checks pass.

## Next Suggested Decision

Atatürk integration is still intentionally on hold. The next sprint should be
chosen from the FootSim maturity queue: score-state chance creation, true
half-time side-switch, live substitution controls, commentary/TTS prototype, or
a focused UAT pass over the Phase 5 build.
