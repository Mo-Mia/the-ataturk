# UAT Handoff — Pre-integration Engine Diagnostic Pass

Last updated: 2026-05-01 16:25 SAST

Use this handoff with the next visualiser video and the JSON artefacts. The goal
is not to recalibrate from vibes; it is to compare visible behaviour against
snapshot ground truth and decide whether any model gap is a true blocker before
Atatürk integration.

## Artefacts

- `packages/match-engine/artifacts/representative-seed-1-v2.json.gz`
- `packages/match-engine/artifacts/forced-early-goal-v2.json.gz`
- `packages/match-engine/artifacts/forced-high-momentum-attack-v2.json.gz`
- `packages/match-engine/artifacts/forced-second-yellow-v2.json.gz`

All current artefacts include:

- `attackMomentum`
- `possessionStreak`
- `diagnostics.shape.home`
- `diagnostics.shape.away`

The visualiser heatmap mode now supports ball, home-player, away-player, and
all-player heatmaps.

## Representative Seed Ground Truth

`representative-seed-1-v2.json.gz`

- Final score: LIV 1-5 MIL
- Shots: LIV 4 / MIL 5
- Fouls: LIV 3 / MIL 1
- Cards: LIV 2 / MIL 1
- Carries: 29
- Crosses: 6
- Cutbacks: 4
- First goal: 56:15, MIL `ac-milan-10`, score 0-4
- Restart: 56:30, LIV kick-off
- Max LIV momentum: 24

Watch this seed for normal match texture: whether the shape diagnostics match
the eye test, whether wide deliveries and support runs look believable, and
whether the heavy Milan result feels like plausible variance rather than a
broken Liverpool attack.

## Forced Early Goal

`forced-early-goal-v2.json.gz`

- Forced goal: 48:00, LIV `home-9`, score 1-3
- Restart: 48:15, MIL kick-off
- Final score: LIV 1-4 MIL
- Crosses/cutbacks after the early goal: 4 / 5

Check:

- goal overlay appears
- ball resets to centre
- players migrate back to kick-off shape
- conceding team kicks off
- momentum/streak reset is visible in the heatmap overlay
- match resumes without players snapping or clustering

## Forced High-momentum Attack

`forced-high-momentum-attack-v2.json.gz`

- Max LIV momentum: 87
- High-momentum support ticks: 38
- Final score: LIV 1-4 MIL
- Shots: LIV 7 / MIL 3
- Crosses/cutbacks: 5 / 3
- First goal: 55:51, LIV `home-5`, score 1-3

Check:

- midfielders/full-backs cross halfway at sensible moments
- support runs do not collapse into swarming
- centre-backs and deeper midfielders remain structurally conservative
- player heatmaps show support beyond halfway, not only forwards in the attacking half
- momentum feels visible but not like a direct scoring boost

## Forced Second Yellow

`forced-second-yellow-v2.json.gz`

- First yellow: 51:00, MIL `away-6`
- Second yellow + red: 51:36, MIL `away-6`
- Player remains off pitch after dismissal

Check only for regressions: card log, player removal, active-player shape
diagnostics, and 10-man shape.

## UAT Questions

- Do support runs look natural now, or still too rigid?
- Does shape stay intact under high momentum?
- Does the ball enter dangerous areas often enough?
- Are shot locations believable, or still too edge/far-heavy?
- Do heatmap numbers support the visual impression?
- Do active-player counts and line-height diagnostics match red-card and momentum scenarios?
- Which missing model from `docs/MATCH_ENGINE_MODEL_GAPS.md`, if any, is genuinely blocking integration?

Always cross-check video observations against the JSON event log and final
summary before treating them as engine facts.
