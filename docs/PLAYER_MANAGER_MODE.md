# Player Manager Mode

> The canonical specification for The Atatürk's core gameplay mode. v0.1 ships with this as the single, mandatory mode — there is no separate "Manager only" path.

## The pitch

You are a reserve player in Liverpool's Champions League matchday squad for the 2005 final. You created your own attributes — within a tight budget — and chose your archetype. Your player exists alongside Gerrard, Carragher, Hyypiä and the rest. When you are off the pitch, you are the manager. When you are on the pitch, you are a player and the team plays the way you set them up before the second-half restart (or before you came on).

You can choose to be on the pitch or on the bench at any moment — at the cost of a substitution.

## The flow

### 1. Player creation (mandatory)
Before the match, the user creates their player:
- **Pick a primary position** (single position, optional secondary)
- **Pick an archetype preset** (8 options + blank slate — see "Presets" below)
- **Allocate attribute points within the budget** (see "Budget" below)
- **Pick a name and squad number** (any valid number not taken; squad number affects nothing gameplay)
- **Save the player** — they're now in Liverpool's squad

The user-player is committed to a single dataset version (the player-creation snapshot). Different match plays = different user-players.

### 2. Half-time selection and tactics
v0.1 begins at half-time, not kickoff. Liverpool are already 0-3 down to Milan. The user-player is on the bench by default because they were a reserve in the first half.

At the half-time decision moment, the user chooses the second-half XI and tactical setup. They can:

- keep the historical players on the pitch
- make normal substitutions
- put the user-player into the second-half XI immediately

Putting the user-player into the XI means subbing them on now. It uses one of the team's three substitutions.

Tactics, formation, sliders are all set during this phase as in regular manager mode. Same UI surface.

### 3. The second half — the state machine

The interesting bit. The user's tactical-control permissions depend on whether the user-player is on the pitch or off it.

#### When user-player is OFF the pitch (bench, or yet to come on)
- All tactical controls available
- Mentality / tempo / pressing / line-height sliders editable in real time
- Substitutions available (any combination, including subbing self on)
- Formation changes available
- Half-time team-talk options fully available before the second-half restart

#### When user-player is ON the pitch
- All tactical controls **frozen** at their last-set state
- Sliders visible but read-only with an explanation banner
- Half-time team-talk options visible but not selectable
- On-field intent toggles available (see below)
- **One action available:** request substitution
  - User picks a replacement from the bench
  - Sub happens at the next iteration boundary
  - Once user-player is off the pitch again, full tactical control returns
- This sub costs one of the team's three substitutions (UEFA 2004/05 rule)

#### The interesting decision space
- Subbing on at half-time = trust your setup, ride out the second half, react only by on-field intent or subbing self off
- Staying on the bench = full manager flex; come on if/when the moment is right
- Subbing self on, then off again = real tactical cost (two subs spent), real reason to do it (regain manager control after seeing how the match developed)
- The user can sub themselves off at any time while on the pitch, *provided the team has remaining substitutions in the bank*

#### Substitution bank
- Standard UEFA 2004/05 final allowance: 3 substitutions
- This is a cap on the team's *total* subs across the match
- User-player subbing on/off counts toward this cap normally
- Subbing the user-player on at half-time counts toward this cap and brings the limit closer immediately
- If the user-player is on the pitch and all 3 subs are spent, the user is locked into being on the pitch for the remainder

### 4. Post-match
- Match report (LLM-generated) frames the result narratively
- User-player gets specific narrative beats: their goals, shots, key moments, fitness/fatigue summary
- A short post-match player-quote (LLM-generated, in user-player's "voice")
- Match outcome is preserved for forum sharing (URL with results encoded, or screenshot)

## User-player on-field intent controls

When the user-player is on the pitch, broad tactical management is frozen, but the user can express personal intent. These controls bias the user's own engine-side behaviour; they do not rewrite the team's tactics.

### Persistent toggles

The user can select up to 3 of these 6 toggles at once:

1. **Look for the killer pass** — biases long-pass and through-ball actions
2. **Take it on yourself** — biases shoot and dribble actions
3. **Get forward** — biases positioning further upfield
4. **Sit deeper** — biases positioning further back
5. **Press the ball** — biases tackle/intercept attempts while defending
6. **Aggressive tackle** — boosts tackle attempt rate and raises foul/card probability; works against the player's natural `tackling` attribute rather than bypassing it

These are persistent until changed, subject to the 3-toggle cap.

### Resource-limited action

7. **Demand the ball** — 3 uses per half. Temporarily buffs teammates' probability of passing to the user-player for one iteration.

### Deferred intent: diving / simulation

A diving or simulation toggle is deliberately deferred to v0.1.5 or v0.2. It requires wrapper-side detection of contact in the box and probability-based adjudication for award/no-award/booking. That is too much engine-adjacent behaviour for v0.1's first playable loop.

## Budget

### Mechanic
- Total attribute points = `(best_player_in_game_total) × budget_multiplier`
- "Best player in game" is determined at match-start by summing across the active dataset version
- 10 attributes × 100 max each = 1000 absolute max; in practice, top-tier players sit around 700–800 total

### Configurable parameters
The following are tuning knobs, not user-facing controls. Hardcoded in `packages/data/src/config/player-budget.ts`:

- `BUDGET_MULTIPLIER` (default `1.05`) — how much above the best player's total the user can allocate
- `MAX_PER_ATTRIBUTE` (default `95`) — caps any single attribute, prevents degenerate "all in one stat" builds
- `MIN_PER_ATTRIBUTE` (default `20`) — floor on any attribute, prevents "0 in defending" gaming
- `BUDGET_MULTIPLIER_RANGE` — soft bounds for testing: 0.8 to 1.5

These can be tweaked during testing without recompiling.

### Position-specific notes
Goalkeepers will have a fundamentally different attribute profile (saving dominates). The `MIN_PER_ATTRIBUTE` floor means a goalkeeper still has nominal outfield attributes; this is fine since the engine never makes them dribble in midfield.

## Presets

Eight archetypes plus a blank slate. Each preset:
- Has a primary position (or position group)
- Provides a starting attribute distribution within the budget
- The user can tweak any attribute after picking — preset is a starting point, not a fixed build

### The eight

1. **Target Man** (ST) — high shooting, strength, jumping, control; lower agility
2. **Speedy Winger** (LW/RW) — high agility, control, perception, passing; lower strength
3. **Trequartista** (AM) — high passing, perception, control, shooting; lower tackling
4. **Box-to-Box Midfielder** (CM) — balanced everything, slight emphasis on strength + passing
5. **Deep-Lying Playmaker** (DM/CM) — high passing, perception, tackling; lower agility, shooting
6. **Ball-Playing Defender** (CB) — high tackling, perception, passing, jumping; lower agility
7. **Marauding Full-Back** (LB/RB) — high agility, tackling, control, perception; lower shooting, jumping
8. **Sweeper-Keeper** (GK) — high saving, perception, agility; lower tackling, jumping

### Plus
9. **Blank slate** — equal distribution, position user-chosen, all attributes start at the equal-share value, user redistributes

## Schema implications

The `players` table needs:
- `player_origin` enum (`'real' | 'user_created'`) — real players get this set to `real` in seed, user players to `user_created`
- `user_id` (nullable, TEXT) — for now a simple session-or-local identifier. FK socket for a future users table.
- `preset_archetype` (nullable, TEXT) — which preset they started from, or NULL for blank slate
- `budget_used` (nullable, INTEGER) — total attribute points, validates against budget at insert time

The `player_attributes` table needs nothing extra — user players use the same attribute schema as real players. The `dataset_version` column distinguishes "the v3 dataset of real players" from "this user's match-start snapshot" by versioning convention.

For v0.1 single-player single-match, we don't need a `match_runs` table. The user-player record is created at match-start, used for one match, persisted. If the user creates another player for a future match, that's just another row.

## Curation lifecycle clarification

Profile and attribute curation use two independent signals:

- **Curated version** means "forked to a named version and activated." This is a workflow-level signal on the version.
- **Edited flag** means "this specific player was hand-edited by a human." This is a granular player-level signal.

These are intentionally independent. Activating a forked profile version does not auto-flip every player's `edited` flag. Step 2B's attribute derivation treats fully populated profiles as ready regardless of edited-flag state; a profile is blocked only when required fields are missing or marked failed.

## Implementation phasing

Player Manager mode is folded into the existing v0.1 plan. The Phase A data layer schema includes the columns above. Phase B (LLM derivation + admin UI) includes the player creator UI as a sibling to the squad editor.

The match-loop work (state machine for tactical permissions, sub-self-on/off mechanics) is a separate task pencilled in for after Phase B.

## What's NOT in v0.1 (deferred)

- Multiple user-players per save (currently: one user creates one player per match)
- Persistent player progression across matches (form, fitness changes between games)
- User-player editing post-creation (you're locked in for the match)
- User-players for other clubs (only Liverpool in v0.1)
- Cosmetic kit / appearance customisation beyond name + squad number
- Skill trees, perks, traits beyond the 10 engine attributes
