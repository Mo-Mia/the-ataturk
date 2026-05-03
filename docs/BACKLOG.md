# Backlog

Non-blocking follow-up work. Things worth doing eventually but not
worth doing now. When picking up an item, move it to a "done" section
or just delete it — git history preserves the trail.

Add new items at the top of the relevant section. If an item sits here
for more than a few months without being addressed, it's probably not
actually worth doing — delete it.

## Match Orchestration

### ~~Half-time historical state — exact stats, simulated micro-state~~ ✅ Done
Shipped in the vertical slice. `server/src/match/half-time-state.ts`
builds the state via `initiateGame()` → `startSecondHalf()`, then
overwrites canonical facts. Liverpool XI uses the corrected second-half
lineup (with Smicer, not Hamann). See commits `98c1228`–`ce60c30`.

## Player Manager mode

### Squad-swapping mechanic after first canonical win
After the user wins the canonical Istanbul scenario, consider unlocking a replayability mode that allows swapping up to 3 Liverpool players for Milan players. No swap-cost system is needed initially. Constraints: preserve the emotional core of Liverpool trying to rewrite the second half; avoid letting swap permutations become the main game; expect balance work because a few Milan players dramatically change Liverpool's ceiling.

### Diving / simulation toggle for user-player
Deferred to v0.1.5 or v0.2. A diving/simulation intent toggle needs wrapper-side detection of contact in the box and probability-based adjudication for penalty awarded, no call, or booking for simulation. Do not add this to the first Player Manager loop.

### Persistent player progression across matches (v0.2+)
Currently a user-player is locked at creation and used for one match only. v0.2 (full Liverpool campaign) needs: form/fitness changes between matches, possible attribute drift, user-player carries across all 30+ matches in a season. Schema is mostly ready — needs a `match_runs` table linking user-players to matches.

### Multiple user-players per save
v0.1 assumes one user-player per match. Eventually: ability to switch between created characters, "save your favourite builds," etc.

### User-player editing post-creation
Currently locked at creation. Worth considering whether mid-season tweaks are interesting or whether they undermine the commitment of the build.

### User-player kit / appearance customisation
Cosmetic only. Probably v0.3+.

## Admin & Data Management

### Squad data management UI with AI-assisted verification
Squad data management UI with AI-assisted verification. Specific design questions to resolve before scoping: source-of-truth for verification (FC25 ingest vs live), write semantics (new dataset version vs mutation), Gemini API cost shape. Aesthetic direction TBD — possible Atatürk-revival hook.

## Refactor

### Complete `VisualiserPage.tsx` decomposition
FootSim Phase 2 partially decomposed the visualiser by lifting reusable stats,
heatmap/shape diagnostics, pitch markings, and event-dock components for the
comparison view. The route file still owns replay controls, artifact loading,
file/drop handling, inspector state, player diagnostics, and page layout.
Finish the split when richer replay controls or comparison-linked scrubbing
force the next natural extraction.

### Extract shared types package
API boundary types are currently duplicated between `packages/data/src/types.ts`
(Node, includes SQLite-specific helpers) and `apps/web/src/admin/lib/api.ts`
(browser-safe types only). When the duplication grows beyond ~3 types, extract
to a new `packages/types` workspace package consumed by both.

## Schema

### Penalty shootout result field
The `fixtures` table has `real_result_home_goals` and `real_result_away_goals`,
which currently capture the on-pitch result (e.g. 3-3 for the 2005 final which
went to penalties). When we model penalty shootouts in the engine we'll need a
separate `penalty_shootout_winner` field, or similar. For now, the `notes`
field is the place this lives.

## Attribute Calibration

### Pirlo penalty_taking review
The Step 2B LLM derivation produced `penalty_taking=92` for Andrea Pirlo. That may be higher than real-world expectation for 2004/05 even if his technique and dead-ball reputation are elite. Revisit when forum feedback comes back and calibrate against other designated takers in the dataset.

## Engine

### Phase 8 manual XI baseline should use Phase 9's 1000-seed result
Phase 9 showed the Phase 8 `-8.09%` manual-XI result was a 200-seed outlier.
Use the 1000-seed paired result (`-15.93%`, 4.31pp SE) when Phase 8 resumes and
avoid treating the smaller Phase 8 sample as the canonical manual-XI baseline.

### Widen manual XI responsiveness threshold for low-goal samples
Manual XI impact is real, but low absolute goal rates create wide confidence
intervals. Future responsiveness gates should avoid a brittle fixed 10% cutoff
unless the seed count is high enough to control that variance.

### Visualiser pitch direction indicator
New Phase 7 runs are side-switch-aware, but the replay UI does not yet show a
clear "home attacking this way" indicator. Add only if UAT users misread the
intentional half-time direction flip.

### Side-switch animation in visualiser
Phase 7 flips direction instantly at half-time. A later polish pass can animate
the reset/side-switch transition if the instant flip reads as visually abrupt.

### Pitch slope and wind effects
Direction-aware engine state makes these possible, but there is no pitch or
weather model yet. Add only if match context or venue variance becomes a
gameplay feature.

### Asymmetric player direction preferences
Some players or teams may prefer attacking a particular end/flank. The engine
does not model that preference; current side-switching is neutral by design.

### Mid-half side-switching for special cases
Current direction changes happen only at half-time. Extra-time quirks, abandoned
matches, or special tournament rules could require more general break-state
side-switching later.

### Chance-creation standalone strength
Phase 6 fixed the score-state composition issue: trailing teams now produce more
late shots. The isolated chance-creation feature flag is still a weak standalone
signal in the real-squad harness. Revisit if UAT shows progressive carries and
through-balls still do not visibly resolve into enough open-play chances outside
late chase states.

### Corner routine choreography
Current corners have calibrated takers, deliveries, aerial targets, and shot
resolution, but no near-post/far-post/short-corner routine choreography.

### Wall-jumping for free kicks
Direct free kicks currently resolve through taker and goalkeeper quality only.
Wall positioning/jumping is deferred.

### Set-piece tactics as tactical lever
Existing tactical levers do not influence set-piece preferences. Add only if
set-piece behaviour becomes a meaningful user-facing choice.

### Designated set-piece defending
No zonal vs man-marking or designated set-piece defensive assignments yet.

### Counter-attack speed differentiation
Transitions after turnovers do not yet distinguish fast counters from slower
settled attacks beyond current tempo/action weighting.

### Individual player instructions
No per-player instructions such as "attempt shots", "hold up ball", or "stay
forward" beyond the earlier accepted override fields.

### Goalkeeper distribution as tactical surface
GK kicking is preserved in v2 metadata but goalkeeper distribution is not yet a
first-class tactical or action-resolution surface.

### Dribble-into-shot mechanics
Chance creation can turn carries into shot opportunities, but there is no
bespoke dribble-into-shot animation or resolution branch.

### Shot-blocking from defenders
Blocked shots exist statistically, but defender positioning and block attempts
are not yet a dedicated mechanic.

### Indirect-FK routine variety
Indirect free kicks currently cross/pass into play with light event detail.
Richer routines are deferred.

### Live in-replay substitution UI
Phase 5 supports scheduled substitutions before simulation and AI Auto Subs.
Live substitutions during replay/control remain deferred.

### Injuries and injury substitutions
Auto Subs currently use fatigue/tactical rules only. Add injuries once fatigue
extremes and player availability matter across broader game modes.

### Fatigue recovery across matches
Current fatigue is per-match only. Multi-match scheduling needs recovery,
rotation pressure, and accumulated condition.

### Formation changes via substitutions
Substitutions currently replace players into the outgoing role. Tactical shape
changes such as defender-for-striker formation shifts are deferred.

### Post-match player ratings
Useful once substitutions, fatigue, and user-player involvement need a readable
summary, but not needed for the current diagnostic workbench.

### ~~True half-time side-switch~~ ✅ Done
Phase 7 added side-switch-aware match state, direction-aware action resolution,
snapshot diagnostics, persisted `sideSwitchVersion`, old-run compatibility, and
visualiser handling. The 500-seed side-switch A/B validation passed statistical
equivalence across shots, goals, fouls, cards, possession, corners, and
set-piece goals.

### ~~Player fatigue modelling~~ ✅ Done
Phase 5 added stamina drain, stamina-scaled movement/action effectiveness, and
final stamina diagnostics. Recovery across matches is tracked separately.

### ~~Substitutions API + UI~~ ✅ Baseline shipped
Phase 5 added scheduled substitutions, AI Auto Subs, substitution events, active
player replacement, persisted substitution summaries, and workbench controls.
Live in-replay substitution control remains deferred.

### Extra time and penalty shootout
Out of scope for FootSim Phase 3. Needed before modelling knockout matches that
remain level after 90 minutes.

### In-match tactical changes
The workbench submits tactics at kick-off only. Later Atatürk integration needs
safe mid-match tactic changes and a clear event/audit trail.

### Manual bench selection
Phase 4 records an automatic seven-player bench alongside manual/automatic XIs.
Future work can let users choose the bench explicitly once substitutions exist.

### Drag-and-drop XI builder
Phase 4 intentionally shipped a simple squad list with starter toggles. Add a
drag-and-drop pitch/XI builder only when line-up editing becomes a primary UX,
not just a diagnostic control.

### Saved line-up presets
Manual XI choices currently apply to one run only. Persist named presets once
Mo needs to compare repeatable line-ups across sessions.

### Role-suitability scoring beyond overall + position
The current XI selector uses primary position, alternative positions, adjacency
fallback, then `overall` and id tie-breaks. Future work can weight role-specific
attributes once the automatic selector needs more football nuance.

### Additional formations
Current supported FootSim formations are `4-4-2`, `4-3-1-2`, `4-3-3`, and
`4-2-3-1`. Add `3-5-2`, `5-3-2`, `4-1-4-1`, and others only with matching XI
templates and visual validation.

### Half-time team talks
The `half_time` marker now exists, but there is no game-state intervention at
the break. Future commentary and Atatürk UX can hang team-talk logic off this
event.

### ~~Score-state-aware behaviour adjustments~~ ✅ Baseline shipped
Phase 5 added a score-state urgency multiplier that shifts pressing, passing
risk, and carrier action weighting. Chance-creation-specific behaviour for
trailing teams is tracked separately above.

### ~~Full 90-minute FootSim support~~ ✅ Baseline shipped
Phase 3 added `full_90` workbench runs by default, 1800 ticks, `half_time` at
45:00, and full-match characterisation support. True half-time side-switch is
tracked separately above.

### ~~Formation-aware FC25 starter-XI selection~~ ✅ Done
Phase 3 added deterministic simulate-time XI selection from the full FC25 squad
for the four supported formations. `fc25_squads.squad_role` remains for
backward compatibility but the simulate endpoint no longer uses it for XI
selection.

### ~~Manual XI override~~ ✅ Done
Phase 4 added manual starting-XI selection for the workbench. The selector
validates exactly 11 players, one goalkeeper, unique squad members, records
out-of-position warnings, and persists XI/bench/selection-mode metadata in run
summaries.

### Movement strategy refactor before the next major movement feature
`packages/match-engine/src/ticks/movement.ts` now carries several interacting
layers: lateral anchors, ball-side shifting, wide runs, vertical support,
momentum influence, and off-ball pulse. Each layer is defensible, but the file
is approaching the point where one-off UAT fixes will be hard to reason about.
Before adding another large movement feature, split movement into per-role or
per-band strategies that consume shared context explicitly.

### Tune Player Manager protagonist impact during Atatürk integration
The responsiveness harness proved that a +15 boost to one mid-attribute
Liverpool outfield player moves home goals by more than the 25% threshold.
However, the absolute lift in the Smicer test was `0.14 -> 0.36` goals across a
second half. During Player Manager integration, tune whether the protagonist
needs a more targeted shooting/composure boost or bespoke involvement logic so
the player feels meaningfully influential without becoming a ball hog.

### Adapt substitution API for Atatürk integration
Phase 5 created the FootSim substitution contract: scheduled substitutions,
bench state, player removal/addition, replacement events, and AI Auto Subs.
Atatürk integration still needs game-specific rules around user-player
self-substitution, historical 2004/05 substitution limits, and whether
formation rebalancing is allowed during the Istanbul half.

### Revisit weak-foot compounding only if v2 finishing drifts
The current v2 weak-foot model applies rated weak-foot penalties to both
shot/on-target mechanics and save difficulty. A temporary experiment applying
the penalty to on-target only moved 50-seed v2 goals from `1.00` to `1.06`,
which is too small to justify changing mechanics now. Reopen only if future v2
calibration puts goals below target or if real-data validation exposes a
finishing issue.

### Re-verify match-engine calibration with first real v2 dataset
The v2 bridge was verified with a synthetic generator deliberately shaped to
preserve v1 calibration values. That was correct for isolating preferred-foot
behaviour, but it does not prove that real FC25-distributed inputs preserve the
same match texture. When the first real v2/FC25-style dataset lands, rerun
50-seed characterisation and recalibrate if shots, goals, fouls, cards or score
distribution drift.

### ~~Engine v2.0 — FC25-compatible attribute bridge~~ ✅ Done
Bridge landed in `packages/match-engine`: FC25-style v2 input types, v2→v1
adapter, v2 snapshot metadata preservation, and weak-foot-aware preferred-foot
shot logic. Engine probability internals remain on the calibrated v1 schema.

Deferred follow-ups now tracked separately:
- Re-verify calibration with the first real FC25-distributed v2 dataset
- Optional Atatürk migration from v1 to v2 player data
- FBref data ingestion module
- Real-world match validation harness

### Normalise `SkillRating` at the engine boundary
The engine's player skill values are typed as `number | string` because
the engine README has loose typing in its examples. This propagates
through our internal code — every consumer of skill values has to call
a `statValue()`-style helper or branch on `typeof`.

When we start building the tactics layer (or any code that reads many
player attributes), add a normalisation function at the engine adapter
boundary that coerces strings to numbers once. Internal types after
normalisation should be `number` only. Engine-facing edge keeps the
loose `number | string` for fidelity to upstream.

Trigger to address: first real consumer of player skills that needs
clean numbers (likely tactics layer).

### ~~Engine realism characterisation test~~ ✅ Superseded
The old backlog item referred to characterising the legacy
`footballsimulationengine` wrapper. The standalone match engine now has its own
50/100-seed characterisation, deterministic snapshots, representative replay
artefacts, and responsiveness harness under `packages/match-engine`. Keep the
legacy item closed unless the old `/match` route needs separate maintenance.

## Visualization

### Histogram bar tie-breaking picker
FootSim Phase 2 histogram bars open the lowest-seed representative run in that
bucket. Future distribution analysis should open a small picker listing all runs
in the bucket, especially when several seeds share the same scoreline or cards
count.

### Pagination cursor migration for large run history
`GET /api/match-engine/runs` uses page/limit pagination for the first persisted
history slice. If the table grows beyond a few thousand rows or list browsing
starts skipping/duplicating under active writes, migrate to cursor pagination.

### Cross-batch distribution comparison
Phase 2 shows one batch's distribution at a time. A later research view should
compare two batches side-by-side for tactic and seed-set analysis.

### Synchronised event-timeline scrubbing
The Phase 2 comparison page renders two independent event timelines. Add
synchronised scrubbing only when users need to compare moment-by-moment
sequences, not just final shape/stat outputs.

### N-way run comparison
Phase 2 deliberately compares two runs only. N-way comparison is deferred until
there is a concrete workflow that needs more than paired analysis.

### Run notes and annotations
Persist analyst notes against `match_runs` once Mo needs to mark interesting
seeds, UAT observations, or handoff comments directly in the workbench.

### SQL-backed advanced run-history filtering and search
Phase 4 added basic server-side filters for club, duration, formation, batch,
seed, and date range. If run history grows large, move filtering fully into SQL
queries and add richer search by team pairing, tactics, notes, and seed ranges.

### Run history eviction policy
Phase 2 ships manual delete only. Add retention/eviction rules after real usage
shows whether artefact volume is a problem.

### ~~Persist FootSim run history across refreshes~~ ✅ Done
FootSim Phase 2 added the `match_runs` table and persisted `/visualise/run`
history server-side. Artefact files remain under
`packages/match-engine/artifacts`, with orphaned rows filtered out of list
responses.

### Reference: GallagherAiden's existing visualisers
Two repos that visualise footballsimulationengine matches:
- github.com/GallagherAiden/footballsimulationexample (basic demo)
- github.com/GallagherAiden/worldcup2018simulator (richer, with
  pre-match flow)
Both 2019-vintage vanilla JS. Useful as architectural reference for
the eventual 2D pitch renderer (engine→canvas coordinate mapping,
basic player/ball rendering). Don't lift code directly.
