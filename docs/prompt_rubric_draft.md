# Player Attribute Derivation — Prompt Rubric (Draft)

> **Status:** Validated draft. This rubric was validated against real LLM output during Phase B Step 2B. The goalkeeper corrections below came from that validation pass.
>
> **Expected to change:** Treat this as the current working rubric, not a permanent calibration. Forum feedback and match-feel testing may still require rating adjustments.
>
> **Last updated:** 2026-04-30 (post-Step-2B validation revision)

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

Tier sets the *quality of headline attributes* — i.e. "what is this player exceptional at?" — not a target total. A specialist S-tier player like Kaká has elite headline attributes (control, passing, agility) but real weaknesses (tackling, strength, jumping); his total ends up lower than a balanced S-tier all-rounder, and that's correct.

## Outfield tier-to-headline guidance (what tier really means)

For outfield players, a player's tier is reflected in **how high their headline attributes go** and **how many attributes are above the various thresholds** — not in their total points.

Goalkeepers are the exception. Do **not** apply the headline-count thresholds below to keepers. Goalkeepers use the GK-specific tier bands in "Goalkeeper-specific notes" instead: saving range plus perception, jumping, and agility expectations.

| Tier | Minimum headlines | What this looks like |
|---|---|---|
| S | At least 3 attributes at 90+, at least 6 at 80+ | Elite at multiple disciplines + strong supporting attributes |
| A | At least 2 attributes at 85+, at least 5 at 75+ | World-class at signature skills + solid all-round |
| B | At least 1 attribute at 82+, at least 4 at 70+ | One real strength + reliable supporting attributes |
| C | At least 1 attribute at 75+, at least 3 at 65+ | A definite strength + adequate elsewhere |
| D | At least 1 attribute at 65+, at least 2 at 55+ | Capable in their core role; otherwise modest |

These are *minimum* guidance for outfield players — a tier-A player can absolutely have 3 attributes at 85+. The point is the floor: a tier-A player should never be missing the headline strengths that define world-class.

A tier-A specialist (e.g. a winger with elite agility and control but middling strength and jumping) might end up with a total in the 640-700 range. A tier-A all-rounder with no glaring weaknesses might hit 720+. **Both are valid tier-A outputs.** The total is not the measure; the headline attributes are.

### Why we don't target totals
We tested this rubric on Kaká (S-tier, age 23). His attributes:
- Headline: control 93, agility 92, passing 90, perception 90 (4 attributes at 90+, 6 at 80+ ✓ S-tier)
- Real weaknesses: tackling 50, strength 60, jumping 65
- Total: ~720

If we'd targeted "S-tier total = 750-800," the LLM would have been forced to inflate Kaká's tackling or strength to hit the band — falsifying the player. The headline-attribute approach correctly captures that he's S-tier *because of his strengths*, not despite his weaknesses.

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
- **Don't compress the elite tier.** Resist the urge to put every famous player at 90+. A player can be world-class overall (high tier) without any single attribute being elite. Gerrard is the canonical example: he was an A-tier all-rounder with no single attribute at 95.
- **Use the full range.** A B-tier player should have attributes in the 50s and 80s, not all in the 70s. Variance within a player tells the engine what they actually do.
- **Specialists are real and valid.** A tier-A player with a 50 in one attribute is not a calibration error — it's a player with a real weakness. Embrace it.

## Position-specific baselines and ceilings

These set engine-realistic minimums and maximums per position. They prevent degenerate outputs (a striker with 80 saving) without locking the LLM into a narrow band.

| Position | High-priority attributes | Floor on these | Cap on `saving` | Notes |
|---|---|---|---|---|
| GK | saving, perception, jumping, agility | saving ≥ 70 | (n/a) | GK-relevant non-saving attributes are perception, jumping, and agility. Outfield-only skills are deliberately modest; passing/control can reach 75 for sweeper-keepers (Dida, Lehmann, etc.). Tier-to-headline guidance is replaced by GK-specific (see below). |
| CB | tackling, jumping, strength, perception | each ≥ 65 for A-tier | ≤ 25 | Pace (agility) is the typical weakness. |
| LB / RB | tackling, agility, perception | each ≥ 60 for A-tier | ≤ 25 | Modern full-backs need stamina (control + agility) too. |
| DM | tackling, perception, passing | each ≥ 70 for A-tier | ≤ 25 | Often weak in shooting and finishing. |
| CM | passing, perception, control | each ≥ 70 for A-tier | ≤ 25 | The most versatile position; build by descriptor. |
| AM | passing, control, perception, shooting | each ≥ 75 for A-tier | ≤ 25 | Often weak in tackling and strength. |
| LW / RW | agility, control, perception | each ≥ 70 for A-tier | ≤ 25 | Crossing is partly captured by passing. |
| ST | shooting, control, perception | each ≥ 75 for A-tier | ≤ 25 | Headers (jumping) optional depending on archetype. Tackling is usually a weakness. |

### Goalkeeper-specific notes

Goalkeepers have a different attribute distribution from outfield players. Do not apply the outfield headline-count table to them. Keepers are evaluated against their own bands because `saving` dominates and because `perception`, `jumping`, and `agility` are genuinely goalkeeper-relevant rather than generic outfield skills.

The headline-attribute guidance for keepers:

- **Tier S keeper:** saving 92–96, perception 85+, jumping 85+, agility 80+
- **Tier A keeper:** saving 84–90, perception 78+, jumping 78+, agility 72+
- **Tier B keeper:** saving 75–82, perception 72+, jumping 72+, agility 68+

A GK rubric beyond headlines:
- `passing` and `control` 50–75 depending on era and style. Dida (2004/05): around 55–60.
- `agility` 65–85 typically — keepers need to dive and recover. This is not capped like an outfield-only skill.
- `perception` and `jumping` are high-priority goalkeeper attributes and should not be capped at generic non-saving levels.
- Outfield-only attributes (`shooting`, `tackling`, and usually `penalty_taking`) should be 20–50. The keeper isn't doing these.
- `strength` can be moderate to strong for physically imposing keepers, typically 60–80, because command of area and contact through bodies matter.
- `penalty_taking` is irrelevant for keepers in match (penalty *saving* is part of `saving`, not `penalty_taking`). Set it 20–40.

## Keyword translation guidance (suggestive, not deterministic)

When encountering evocative qualitative language, translate to attributes by considering CONTEXT — position, tier, and the rest of the descriptor. These are typical contributions, not rules.

| Phrase | Typical contribution | Context modifiers |
|---|---|---|
| "dominant aerial" | High `jumping`, high `strength` | If centre-back, also high `tackling`. |
| "elite positioning" | High `perception` | Most positions. |
| "limited turning speed" / "lumbering" | Low `agility` | Even for big players who are otherwise quick in straight lines. |
| "wizard" / "silky" | High `control` | If attacking player, also high `agility`. If deep playmaker, also high `perception`. |
| "destroyer" / "ball-winner" / "snapping into tackles" | High `tackling`, high `strength` | Sometimes low `agility` if "lumbering" is also implied. |
| "engine" / "non-stop" / "tireless" | Higher across the board (no specific attribute), implies tier B+ | Doesn't directly map to one stat. |
| "elegant" / "composed" | High `control`, high `perception` | Not necessarily high `agility`. |
| "thunderous shot" / "rocket" | High `shooting` | Standalone attribute. |
| "Hollywood passes" / "ping a 40-yarder" | High `passing` (in long-range sense) | Implies the player has range, not just short distribution. |
| "carries the team" / "talisman" | Higher tier overall, often high `perception` | Indirect indicator; modifies overall total via headline floor. |
| "metronome" / "tempo-setter" | High `passing`, high `perception` | Typical of deep midfielders. |
| "marauding" / "rampaging" | High `agility`, high `strength` | Typical of attacking full-backs. |
| "set-piece specialist" | High `passing` and/or `shooting` | If penalty-taker also implied: high `penalty_taking`. |
| "harasses opponents" / "snarling" | High `tackling`, possibly high `agility` | Defensive midfielder vocabulary. |
| "graceful" / "drives through midfield" | High `control`, high `agility` | Attacking midfielder vocabulary. |
| "slight frame" / "rarely wins physical battles" | Low `strength` | Doesn't always imply low jumping; agile players can be tall and slight. |
| "adequate but not progressive" (passing/control) | Around 55-65 | Used for keepers with limited distribution. |

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
- Do not target a specific total. Targeting the headline thresholds is correct; targeting a sum of all attributes is not.

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

These have been validated by manual rubric application. The LLM's outputs should be reproducible to within ~3 points per attribute when given the same inputs.

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
  "shooting": 38,
  "tackling": 86,
  "saving": 12,
  "agility": 56,
  "strength": 84,
  "penalty_taking": 35,
  "perception": 90,
  "jumping": 88,
  "control": 70
}
```

**Tier-A headline check:** ✓ tackling 86, perception 90 (2 at 85+); jumping 88, strength 84, control 70, passing 70, agility 56 — that's 6 attributes at 70+ (5 expected for A). Passes.

**Reasoning:**
- Tackling 86 = world-class but not generational; he wasn't Nesta-level technically.
- Perception 90 = "elite positioning" earns the elite tier.
- Jumping 88 = "dominant aerial" but not 95+ because he's 31 and his peak aerial years are behind him.
- Strength 84 = strong but the descriptor doesn't emphasise raw physicality.
- Agility 56 = "limited turning speed" puts him below average even for a CB.
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

**Tier-A headline check:** ✓ shooting 90, passing 88, perception 85, control 84, strength 84 — that's 4 attributes at 84+, well clear of the 2-at-85+ floor (perception/shooting/passing). 9 attributes at 75+. Passes.

**Reasoning:**
- Shooting 90 = "thunderous shot" + actual real shooting record. His standout attribute.
- Passing 88 = "40-yard pass on a dime" earns high passing but not elite — Gerrard was famously a *long-range* passer, not a Pirlo-style short-pass metronome.
- Tackling 80 = "aggressive in the tackle" earns above-average for a midfielder.
- Perception 85 = "carries the team" implies leadership and game-reading.
- Strength 84 = "explosive ... dynamo" earns physical respect.
- Agility 80 = explosive but not Iniesta-quick.
- Penalty_taking 80 = he was a regular taker, with both glory and misses.
- Saving / jumping at midfielder norms.

### Example 3 — S-tier attacking midfielder, structural specialist (Kaká)

**Input:**
```json
{
  "name": "Ricardo Kaká",
  "position": "AM",
  "age_at_match": 23,
  "tier": "S",
  "role_2004_05": "Milan's primary creator, 36 Serie A apps with 7 goals + 5 assists, played every Champions League knockout match, peak years incoming",
  "qualitative_descriptor": "graceful Brazilian playmaker. Devastating with the ball at his feet driving through midfield. Composed finisher. Excellent vision and timing of runs. Slight frame; rarely wins physical battles but agile enough to evade them."
}
```

**Output:**
```json
{
  "passing": 90,
  "shooting": 84,
  "tackling": 50,
  "saving": 15,
  "agility": 92,
  "strength": 60,
  "penalty_taking": 80,
  "perception": 90,
  "jumping": 65,
  "control": 93
}
```

**Tier-S headline check:** ✓ control 93, agility 92, passing 90, perception 90 (4 attributes at 90+; 3 needed); shooting 84, penalty_taking 80, control/agility/passing/perception all 80+ (6 at 80+; 6 needed). Passes.

**Reasoning:**
- Control 93 = peak Kaká, "devastating with the ball at his feet" is in the elite band.
- Agility 92 = "agile enough to evade physical battles" + "driving through midfield" = elite.
- Passing 90 = "excellent vision and timing of runs" earns elite passing without being 95+ (he's a creative playmaker, not a Pirlo-style metronome).
- Perception 90 = "excellent vision" is positional/timing intelligence.
- Shooting 84 = "composed finisher" earns world-class but he wasn't a 90+ pure goalscorer.
- Strength 60, jumping 65 = "slight frame; rarely wins physical battles" — these are real weaknesses, and the rubric correctly captures them.
- Tackling 50 = AM with no defensive descriptor; below the position floor for tier A but Kaká wasn't tier-A defensively, he was tier-S because of his strengths.
- The total ends up around 720, lower than older tier-S guidance suggested. **This is correct** — Kaká's specialism is what makes him S-tier, not balance.

### Example 4 — A-tier goalkeeper (Dida)

**Input:**
```json
{
  "name": "Nelson de Jesus Silva 'Dida'",
  "position": "GK",
  "age_at_match": 31,
  "tier": "A",
  "role_2004_05": "first-choice GK, every CL knockout match, 0.6 goals conceded per CL game, kept 5 clean sheets in CL run",
  "qualitative_descriptor": "imposing 6'4\" Brazilian. Excellent shot-stopper, commanding in the air. Penalty-saving record one of the best in Europe. Distribution adequate but not progressive."
}
```

**Output:**
```json
{
  "passing": 58,
  "shooting": 22,
  "tackling": 22,
  "saving": 88,
  "agility": 76,
  "strength": 78,
  "penalty_taking": 30,
  "perception": 82,
  "jumping": 84,
  "control": 60
}
```

**GK Tier-A headline check:** ✓ saving 88 (band 84-90), perception 82 (≥78), jumping 84 (≥78). Passes.

**Reasoning:**
- Saving 88 = "excellent shot-stopper" + "penalty-saving record one of the best" — towards the top of the tier-A band.
- Jumping 84 = "commanding in the air" + 6'4" — strong but not max.
- Strength 78 = imposing physical presence.
- Perception 82 = command of area, but not top-1% reading-the-game.
- Agility 76 = good for a tall keeper; below the 80+ of smaller, more reactive keepers.
- Passing 58 / control 60 = "adequate but not progressive" puts him at average for a GK.
- Penalty_taking 30 = low because he's a keeper, even though his saving record on penalties is excellent (which falls under `saving`, not `penalty_taking`).
- Outfield attributes (shooting, tackling) at GK floor.

### Example 5 — B-tier defensive midfielder (Gattuso)

**Input:**
```json
{
  "name": "Gennaro Gattuso",
  "position": "DM",
  "age_at_match": 27,
  "tier": "B",
  "role_2004_05": "first-choice defensive midfielder for Milan, every CL knockout match, partner to Pirlo in midfield",
  "qualitative_descriptor": "snarling ball-winner. Tireless engine, aggressive in the tackle, harasses opponents into submission. Limited technique on the ball - he's there to win it back, not to spray passes. Strong physically despite modest height. Excellent at reading the game defensively."
}
```

**Output:**
```json
{
  "passing": 65,
  "shooting": 58,
  "tackling": 86,
  "saving": 18,
  "agility": 78,
  "strength": 84,
  "penalty_taking": 50,
  "perception": 80,
  "jumping": 65,
  "control": 65
}
```

**Tier-B headline check:** ✓ tackling 86 (1 at 82+ needed), strength 84, perception 80, agility 78 (4 at 70+ needed). Passes.

**Reasoning:**
- Tackling 86 = he was *the* archetypal ball-winner of his era; high tier-B headline.
- Strength 84 = "strong physically despite modest height" earns above-average.
- Perception 80 = "excellent at reading the game defensively" + decade of experience.
- Agility 78 = "tireless engine" implies stamina-driven movement, captured here as agility.
- Passing 65, control 65 = "limited technique on the ball" — modest.
- Shooting 58 = he wasn't a goalscorer, but not negligible either.
- penalty_taking 50 = unremarkable, took some but not a designated taker.
- Saving / jumping at midfielder norms.

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
- The headline-attribute floors for D-tier players are aggressive — they may produce 'too capable' D-tier players. Worth re-checking once we have C and D players in the dataset (Liverpool's fringe squad is the place to test this).
