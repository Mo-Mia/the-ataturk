# Backlog

## Player Manager mode

### Persistent player progression across matches (v0.2+)
Currently a user-player is locked at creation and used for one match only. v0.2 (full Liverpool campaign) needs: form/fitness changes between matches, possible attribute drift, user-player carries across all 30+ matches in a season. Schema is mostly ready — needs a `match_runs` table linking user-players to matches.

### Multiple user-players per save
v0.1 assumes one user-player per match. Eventually: ability to switch between created characters, "save your favourite builds," etc.

### User-player editing post-creation
Currently locked at creation. Worth considering whether mid-season tweaks are interesting or whether they undermine the commitment of the build.

### User-player kit / appearance customisation
Cosmetic only. Probably v0.3+.


Non-blocking follow-up work. Things worth doing eventually but not
worth doing now. When picking up an item, move it to a "done" section
or just delete it — git history preserves the trail.

Add new items at the top of the relevant section. If an item sits here
for more than a few months without being addressed, it's probably not
actually worth doing — delete it.

## Schema

### Penalty shootout result field
The `fixtures` table has `real_result_home_goals` and `real_result_away_goals`,
which currently capture the on-pitch result (e.g. 3-3 for the 2005 final which
went to penalties). When we model penalty shootouts in the engine we'll need a
separate `penalty_shootout_winner` field, or similar. For now, the `notes`
field is the place this lives.

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
