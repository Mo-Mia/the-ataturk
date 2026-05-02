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

### Full 90-minute FootSim support
FootSim Phase 1 deliberately runs second-half-only simulations through
`duration: "second_half"`: 900 ticks, 0-0 start. Full 90-minute support is
deferred because it needs a separate calibration pass and likely separate
workbench wording around first-half/second-half context.

### Formation-aware FC25 starter-XI selection
The FC25 importer currently locks a formation-neutral starting XI at ingest
time, then reuses that XI across all submitted formations. This is good enough
for the first workbench slice, but future squad work should select or rebalance
the XI based on submitted formation and available positions.

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

### Define the real substitution API
The responsiveness harness includes `__testApplyMidMatchAttributeSwap` for a
scripted 60-minute swap. This intentionally proves engine sensitivity without
creating a public substitution contract. Atatürk integration still needs a real
substitution API covering bench state, player removal/addition, formation
rebalancing, and event emission.

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

### Run history filtering and search
Add filters by team, date range, tactics, seed range, and batch once persisted
history grows beyond the current newest-first list.

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
