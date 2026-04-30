# Backlog

Non-blocking follow-up work. Things worth doing eventually but not
worth doing now. When picking up an item, move it to a "done" section
or just delete it — git history preserves the trail.

Add new items at the top of the relevant section. If an item sits here
for more than a few months without being addressed, it's probably not
actually worth doing — delete it.

## Match Orchestration

### Half-time historical state — exact stats, simulated micro-state
The match begins at the half-time whistle with Liverpool 0-3 Milan and
45 minutes already played. The implementation must construct a
`matchDetails` object that the engine can resume from.

Decision: hand-curate the gameplay-visible stats: goals, scorers, goal
times, shots on/off per team, possession split, corners, fouls, and cards.
Use an approximation for engine-internal state such as ball position,
per-iteration state, and individual player sub-stats.

Reference: 2005 final first half. Maldini 1' from a Pirlo free kick,
Crespo 39' from Kaká, Crespo 44' from Kaká. Milan were dominant in
possession, roughly 60/40, with about 8 shots to Liverpool's 1 and
around 3 corners each. Maldini's goal came from a Pirlo free kick after
Sissoko fouled Kaká just outside the box; use a Hamann/Carragher
equivalent if we do not model that fixture detail.

Implementation belongs in match orchestration, likely a
`buildHalfTimeMatchState()` function that returns a partially populated
`MatchDetails` consumed by the engine for the second-half tick loop.

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

### Engine realism characterisation test
We currently have a deterministic smoke test (seeded RNG, asserts
threshold-of-6-shots etc.). Useful for catching regressions but doesn't
validate that the engine produces realistic football across the random-
seed distribution.

Add a separate characterisation test that:
- Runs the engine across N seeds (e.g. 100)
- Reports distribution of: goals, shots, possession split, fouls,
  match length stability
- Asserts wide statistical bounds (e.g. avg goals across 100 matches
  is between 1.5 and 5.0)

Goal: catch realism regressions if we ever fork or patch the engine,
and establish a baseline before we start applying tactics modifiers.

Trigger to address: when we begin patching engine internals OR when
the tactics layer is functional and we want to verify our modifiers
don't push the engine into unrealistic territory.
