# Player Attribute Derivation — Prompt Rubric (Draft)

> **Status:** Draft. This is the working document for the LLM-driven attribute derivation that lands in Phase B Step 2. Phase B Step 1 (the Admin Data Harness) builds the surface that consumes these outputs but does not call the LLM yet.
>
> **Expected to change:** Once we see real LLM output across Liverpool + Milan squads, this rubric will be revised. Don't treat any number here as final until a full squad has been generated and a Mo-test match played with them.
>
> **Last updated:** 2026-04-29

## Purpose

Transform a structured player profile (position, age, tier, role, qualitative descriptor) into a precise JSON object containing 10 numerical ratings (0–100 scale). Used by the admin tool to populate `player_attributes` records under named dataset versions.

## The 10 attributes

These must match the engine's `PlayerSkill` schema exactly. See `packages/engine/src/engine/types.ts`.

- `passing` — short, medium, and long-range distribution
- `shooting` — striking the ball with intent (technique + power)
- `tackling` — challenging for the ball, both standing and slide
- `saving` — goalkeeping shot-stopping (negligible for outfield)
- `agility` — quickness of movement, change of direction, balance
- `strength` — physical resilience, holding off opponents, set-piece duels
- `penalty_taking` — composure and technique from the spot specifically
- `perception` — game intelligence, anticipation, positional awareness
- `jumping` — aerial ability, both attacking and defensive
- `control` — first touch, close ball control, dribbling

## Input shape

The derivation function takes a single JSON object:

```json
{
  "name": "Sami Hyypiä",
  "position": "CB",
  "age_at_match": 31,
  "tier": "A",
  "role_2004_05": "first-choice CB, 38 PL apps, every CL match",
  "qualitative_descriptor": "dominant aerial centre-back; elite positioning; limited turning speed; composed on the ball but rarely plays long Hollywood passes"
}
```

### Input field semantics

- **`name`** — Used for context in commentary; LLM should not let famous-name bias influence ratings beyond what `tier` justifies.
- **`position`** — One of the 10-position enum (`GK`, `CB`, `LB`, `RB`, `DM`, `CM`, `AM`, `LW`, `RW`, `ST`). Determines positional baselines (see below).
- **`age_at_match`** — At the date of the 2005 final (25 May 2005). Used to apply age-curve adjustments.
- **`tier`** — Human-curated, the most powerful lever. See "Tier definitions" below.
- **`role_2004_05`** — Concrete usage during the season. Disambiguates "world-class but injured all year" from "world-class and dominant."
- **`qualitative_descriptor`** — The narrative scout report. Free-form, evocative, era-appropriate.

## Tier definitions (human-curated input)

The user assigns one of these tiers per player based on real-world reputation in 2004/05:

- **`S`** — Generational talent at peak. Ballon d'Or contender. Maybe 5-8 players in the world. Examples in this dataset: Kaká (peak), Shevchenko, Maldini (legacy + form), arguably Pirlo and Gerrard.
- **`A`** — World-class. Champions League regular starter for a top club. Top 50 in the world at their position. Examples: Hyypiä, Cafu, Stam, Nesta, Xabi Alonso, Seedorf, Crespo.
- **`B`** — Solid top-flight starter. Champions League standard. Reliable for a top-six club but not their best player. Examples: Carragher, Finnan, Garcia, Kewell, Baros, Gattuso.
- **`C`** — Squad player at a top club, or starter at a mid-table club. Capable but with notable limitations. Examples: Traoré, Riise (often), Smicer, Biscan, possibly Cissé in 2004/05 form.
- **`D`** — Fringe player, youth, or notable weakness even at squad level. Mostly rotation and injury cover.

Tier sets the *centre of gravity* for the player's attribute totals, not specific values. An A-tier striker has different highs and lows than an A-tier defender, but their *totals* should be roughly comparable.

## Tier-to-total guidance

These are approximate target totals across all 10 attributes. Treat as soft anchors, not hard caps.

| Tier | Approximate total | Notes |
|---|---|---|
| S | 750–800 | The truly elite. Compress this range; very few players sit here. |
| A | 680–740 | The bulk of "world-class" players. |
| B | 620–680 | Reliable top-flight. |
| C | 560–620 | Squad players, mid-table starters. |
| D | 500–560 | Fringe / cover. |

Goalkeepers are an exception — see the goalkeeper notes below.

## Scale anchors (0–100)

Calibrated to the dataset, not the world. Assume the population is "appeared in the 2004/05 Champions League."

- **97–100** — Once-in-a-generation specialists at this *specific* attribute. Almost no one. Reserve for genuine outliers (Maldini's positional sense at peak, prime Xavi's passing, peak Beckham's crossing).
- **90–96** — Elite at this attribute. Champions League's best 1–3 players in this skill. Examples: Pirlo's passing, Nesta's tackling, Buffon's saving, Kaká's control at 23.
- **84–89** — World-class at this attribute. Top 10–20 in this skill across European football. The standout strengths of A-tier players.
- **78–83** — Very strong. A clear strength. Standard for an A-tier player's secondary attributes; the headline attributes of a B-tier player.
- **70–77** — Above-average top-flight. Solid; expected of any top-flight regular at their position-relevant attributes.
- **60–69** — Average top-flight. Adequate but unremarkable. Position-relevant attributes for a C-tier player; secondary attributes for a B-tier player.
- **50–59** — Below average. A noted weakness for a top-flight player.
- **30–49** — Poor. Position-irrelevant attributes for outfield players (e.g. a CB's penalty_taking, an ST's tackling).
- **10–29** — Negligible. Hard floor for outfield players' `saving`. Striker's defensive attributes.
- **0–9** — Reserve for engine compatibility issues only; in practice, no real player sits here.

### Important calibration notes

- **The S-tier ceiling exists for a reason.** Don't put four S-tier strikers at 95 shooting. If Shevchenko is 92, Crespo is 88, and Trezeguet is 86, the relative ordering is what matters; absolute numbers should be conservative.
- **Don't compress the elite tier.** Resist the urge to put every famous player at 90+. A player can be world-class overall (high total, high tier) without any single attribute being elite. Gerrard is the canonical example: he was an A-tier all-rounder with no single attribute at 95.
- **Use the full range.** A B-tier player should have attributes in the 50s and 80s, not all in the 70s. Variance within a player tells the engine what they actually do.

## Position-specific baselines and ceilings

These set engine-realistic minimums and maximums per position. They prevent degenerate outputs (a striker with 80 saving) without locking the LLM into a narrow band.

| Position | High-priority attributes | Floor on these | Cap on `saving` | Notes |
|---|---|---|---|---|
| GK | saving, perception, jumping | saving ≥ 70 | (n/a) | Outfield attributes capped at 60 except passing/control which can reach 75 for sweeper-keepers (Dida, Lehmann, etc.). Tier-to-total guidance is replaced by GK-specific (see below). |
| CB | tackling, jumping, strength, perception | each ≥ 65 for A-tier | ≤ 25 | Pace (agility) is the typical weakness. |
| LB / RB | tackling, agility, perception | each ≥ 60 for A-tier | ≤ 25 | Modern full-backs need stamina (control + agility) too. |
| DM | tackling, perception, passing | each ≥ 70 for A-tier | ≤ 25 | Often weak in shooting and finishing. |
| CM | passing, perception, control | each ≥ 70 for A-tier | ≤ 25 | The most versatile position; build by descriptor. |
| AM | passing, control, perception, shooting | each ≥ 75 for A-tier | ≤ 25 | Often weak in tackling and strength. |
| LW / RW | agility, control, perception | each ≥ 70 for A-tier | ≤ 25 | Crossing is partly captured by passing. |
| ST | shooting, control, perception | each ≥ 75 for A-tier | ≤ 25 | Headers (jumping) optional depending on archetype. Tackling is usually a weakness. |

### Goalkeeper-specific notes

GK total scale is different from outfield. The expected total for a tier-A keeper is 550–620, much lower than an outfield A-tier (680–740), because most outfield attributes are *deliberately low* for a keeper.

A GK rubric:
- `saving` is the headline attribute. S-tier keeper: 92–96. A-tier keeper: 84–90. B-tier: 75–82.
- `perception` should be 70+ for any starter. Communication, command of area.
- `jumping` should be 70+ for tier A and above. Important for crosses and shots into the corners.
- `passing` and `control` 50–75 depending on era and style. Dida (2004/05): around 55–60.
- `agility` 65–80 typically — keepers need to dive and recover.
- All other attributes (shooting, tackling, penalty_taking, strength) should be 20–50. The keeper isn't doing these.
- `penalty_taking` is irrelevant for keepers in match (penalty *saving* is part of `saving`). Set it 20–40.

## Keyword translation guidance (suggestive, not deterministic)

When encountering evocative qualitative language, translate to attributes by considering CONTEXT — position, tier, and the rest of the descriptor. These are typical contributions, not rules.

| Phrase | Typical contribution | Context modifiers |
|---|---|---|
| "dominant aerial" | High `jumping`, high `strength` | If centre-back, also high `tackling`. |
| "elite positioning" | High `perception` | Most positions. |
| "limited turning speed" / "lumbering" | Low `agility` | Even for big players who are otherwise quick in straight lines. |
| "wizard" / "silky" | High `control` | If attacking player, also high `agility`. If deep playmaker, also high `perception`. |
| "destroyer" / "ball-winner" / "snapping into tackles" | High `tackling`, high `strength` | Sometimes low `agility` if "lumbering" is also implied. |
| "engine" / "non-stop" | Higher across the board (no specific attribute), implies tier B+ | Doesn't directly map to one stat. |
| "elegant" / "composed" | High `control`, high `perception` | Not necessarily high `agility`. |
| "thunderous shot" / "rocket" | High `shooting` | Standalone attribute. |
| "Hollywood passes" / "ping a 40-yarder" | High `passing` (in long-range sense) | Implies the player has range, not just short distribution. |
| "carries the team" / "talisman" | Higher tier overall, often high `perception` | Indirect indicator; modifies overall total. |
| "metronome" / "tempo-setter" | High `passing`, high `perception` | Typical of deep midfielders. |
| "marauding" / "rampaging" | High `agility`, high `strength` | Typical of attacking full-backs. |
| "set-piece specialist" | High `passing` and/or `shooting` | If penalty-taker also implied: high `penalty_taking`. |

## Age-curve adjustments

Apply at the end after attribute generation. These are small nudges, not large penalties.

- **Age 17–19** (Cristiano Ronaldo, Wayne Rooney in 2004/05): −5 to physical attributes (`strength`, `jumping`), normal everything else. Their growth happens *after* this season.
- **Age 20–22**: small −1 or −2 to `perception` only. Otherwise normal.
- **Age 23–28**: peak. No adjustment.
- **Age 29–31**: no adjustment. They're still in their prime for most attributes.
- **Age 32–34** (Hyypiä, Stam, Cafu): −2 to `agility` only.
- **Age 35+** (Maldini, Tugay): −5 to `agility`, −3 to `strength`, +2 to `perception` (experience compensates).

These are guidelines. Override based on the descriptor — if the text says "still has the legs at 35" then don't apply the agility penalty.

## What NOT to invent

The LLM should not fabricate facts not in the input. Specifically:

- Do not infer suspensions, injuries, or specific match performances unless mentioned in `role_2004_05` or `qualitative_descriptor`.
- Do not let famous-name bias inflate ratings beyond what tier and descriptor justify. (Counter-example to ignore: "Gerrard is famous, therefore 95+ everywhere.")
- Do not output any field not in the schema.
- Do not output reasoning text alongside JSON. The rationale field captures reasoning if requested separately.

## Output schema

Strict JSON, exact 10 keys, integers 0–100:

```json
{
  "passing": 0,
  "shooting": 0,
  "tackling": 0,
  "saving": 0,
  "agility": 0,
  "strength": 0,
  "penalty_taking": 0,
  "perception": 0,
  "jumping": 0,
  "control": 0
}
```

Use Gemini's structured output mode (`responseMimeType: "application/json"` + `responseSchema`) to enforce this. Do not rely on the prompt alone.

## Worked examples

### Example 1 — A-tier centre-back (Hyypiä)

**Input:**
```json
{
  "name": "Sami Hyypiä",
  "position": "CB",
  "age_at_match": 31,
  "tier": "A",
  "role_2004_05": "first-choice CB, 38 PL apps, every CL match including final",
  "qualitative_descriptor": "dominant aerial centre-back; elite positioning; limited turning speed; composed on the ball but rarely plays long Hollywood passes"
}
```

**Output:**
```json
{
  "passing": 70,
  "shooting": 40,
  "tackling": 86,
  "saving": 12,
  "agility": 55,
  "strength": 84,
  "penalty_taking": 38,
  "perception": 90,
  "jumping": 88,
  "control": 70
}
```

**Total:** 633 (within A-tier guidance; slightly low because his age is starting to bite).

**Reasoning:**
- Tackling 86 = world-class but not generational; he wasn't Nesta-level technically.
- Perception 90 = "elite positioning" earns the elite tier.
- Jumping 88 = "dominant aerial" but not 95+ because he's 31 and his peak aerial years are behind him.
- Strength 84 = strong but the descriptor doesn't emphasise raw physicality.
- Agility 55 = "limited turning speed" puts him below average even for a CB.
- Passing 70 = "composed on the ball" earns above-average; "rarely plays long Hollywood passes" prevents going higher.
- Control 70 = composed but unremarkable.
- Saving / shooting / penalty_taking are at outfield-defender lows.

### Example 2 — A-tier midfielder, Liverpool talisman (Gerrard)

**Input:**
```json
{
  "name": "Steven Gerrard",
  "position": "CM",
  "age_at_match": 24,
  "tier": "A",
  "role_2004_05": "captain, every-match starter, talisman",
  "qualitative_descriptor": "explosive box-to-box dynamo. Can hit a 40-yard pass on a dime, thunderous shot, aggressive in the tackle. Carries the team."
}
```

**Output:**
```json
{
  "passing": 88,
  "shooting": 90,
  "tackling": 80,
  "saving": 18,
  "agility": 80,
  "strength": 84,
  "penalty_taking": 80,
  "perception": 85,
  "jumping": 75,
  "control": 84
}
```

**Total:** 764 (top of A-tier; "carries the team" justifies pushing high).

**Reasoning:**
- Shooting 90 = "thunderous shot" + actual real shooting record. His standout attribute.
- Passing 88 = "40-yard pass on a dime" earns high passing but not elite — Gerrard was famously a *long-range* passer, not a Pirlo-style short-pass metronome.
- Tackling 80 = "aggressive in the tackle" earns above-average for a midfielder.
- Perception 85 = "carries the team" implies leadership and game-reading.
- Strength 84 = "explosive ... dynamo" earns physical respect.
- Agility 80 = explosive but not Iniesta-quick.
- Penalty_taking 80 = he was a regular taker, with both glory and misses.
- Saving / jumping at midfielder norms.

### Example 3 — A-tier goalkeeper (Dida)

**Input:**
```json
{
  "name": "Nelson de Jesus Silva 'Dida'",
  "position": "GK",
  "age_at_match": 31,
  "tier": "A",
  "role_2004_05": "first-choice GK, every CL match, conceded 0.6 per CL game",
  "qualitative_descriptor": "imposing 6'4\" Brazilian. Excellent shot-stopper, commanding in the air. Penalty-saving record one of the best in Europe. Distribution adequate but not progressive."
}
```

**Output:**
```json
{
  "passing": 60,
  "shooting": 25,
  "tackling": 25,
  "saving": 87,
  "agility": 76,
  "strength": 78,
  "penalty_taking": 30,
  "perception": 82,
  "jumping": 84,
  "control": 60
}
```

**Total:** 607 (within GK tier-A guidance of 550–620).

**Reasoning:**
- Saving 87 = world-class shot-stopper, not Buffon-level (would be 90+) but clearly elite.
- Jumping 84 = "commanding in the air" + 6'4" — high but not max.
- Strength 78 = imposing physical presence.
- Perception 82 = high command of area, but not top-1% reading-the-game.
- Agility 76 = good for a tall keeper; below the 80+ of smaller, more reactive keepers.
- Passing 60 / control 60 = "adequate but not progressive" puts him at average for a GK.
- Penalty_taking 30 = low because he's a keeper, even though his saving record on penalties is excellent (which falls under `saving`, not `penalty_taking`).
- Outfield attributes (shooting, tackling) at GK floor.

## Process notes

When the LLM produces output that feels wrong:

1. **First check the input.** Did `tier` reflect actual reputation? Did `qualitative_descriptor` capture the real strengths/weaknesses? Often the input is the problem, not the model.
2. **Adjust the descriptor.** If "limited turning speed" should be "okay turning, struggles in 1v1s" — rewrite, re-derive.
3. **Adjust the tier.** Borderline players may need to move A↔B. The tier is a deliberate human lever.
4. **Manual override.** The admin tool should always allow direct attribute editing. The LLM is a starting point, not the source of truth.

## Open questions for revision

- How much do we want the model to consider age-of-the-game (i.e. early-career players may have growth potential we explicitly don't model)? Currently we don't — players are static at match-day skill.
- Should the rubric include a `style_modifier` input (e.g. "playing on the wing despite being a striker by trade")? Currently captured in `qualitative_descriptor` but could be a structured field.
- Per-attribute confidence/error bands? The model could output `"passing": 88, "passing_confidence": "high"` to flag where it's certain vs guessing. Not in v0.1; consider for revision.