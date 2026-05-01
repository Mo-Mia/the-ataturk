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

### Engine realism characterisation test — in progress
We currently have a deterministic smoke test (seeded RNG, asserts
threshold-of-6-shots etc.). Useful for catching regressions but doesn't
validate that the engine produces realistic football across the random-
seed distribution.

A characterisation script (`server/src/match/characterise.ts`) is being
built to run the match across N seeds and report distributions of goals,
shots, fouls, cards, and semantic events.

**Trigger**: the vertical slice's first fast-forward run produced only
2 semantic events across 450 iterations. This may be an event extraction
gap, an engine behaviour pattern, or a state setup issue. The
characterisation script will diagnose which.

See `docs/DECISIONS.md` for the decision entry.

## Visualization

### Reference: GallagherAiden's existing visualisers
Two repos that visualise footballsimulationengine matches:
- github.com/GallagherAiden/footballsimulationexample (basic demo)
- github.com/GallagherAiden/worldcup2018simulator (richer, with
  pre-match flow)
Both 2019-vintage vanilla JS. Useful as architectural reference for
the eventual 2D pitch renderer (engine→canvas coordinate mapping,
basic player/ball rendering). Don't lift code directly.
