# Decision Log

Append-only. Newest at the top. Each entry: date, decision, rationale, alternatives considered.

---

## 2026-04-30 — Patching `footballsimulationengine` upstream bug (truthiness in discovery)
A critical null-reference crash was discovered in `lib/actions.js` where `index` results from `findIndex` were checked for truthiness (`if (index)`) instead of existence (`if (index > -1)`). This caused crashes on non-discovery (-1 is truthy) and silent failures for the first player in any roster (0 is falsy). Given the engine's age and our "wrap, don't fork" strategy, we have applied a direct local patch to `node_modules`. Long-term strategy: use `patch-package` to maintain the patch or fork if further stability issues arise. See `docs/CHARACTERISATION.md`.

---

## 2026-04-30 — Vertical slice ships text-only match playback
The first playable match is plain text only — no commentary, no audio, no broadcast styling. The goal is engine validation: does the football look right? UI polish, commentary, TTS, and match HUD all build on top of a working text-only base. Decision deferred: layout and styling for the eventual `/match` page, handled in a future sprint after engine output is validated.

## 2026-04-30 — Pivot v0.1 to second-half-only Istanbul
v0.1 now starts at the half-time whistle of the 2005 Champions League final, with Liverpool already 0-3 down to Milan and 45 minutes already played. The user takes control in the dressing room, has a short decision window for team-talk, tactics, substitutions, and optional self-substitution, then plays only the second half plus extra time/penalties if reached. Rationale: the project is named after the Atatürk and the second half is the emotionally important object; starting at kickoff asks the user to prevent the very disaster that gives Istanbul its meaning. See `PROJECT_BRIEF.md`, `LORE.md`, and `PLAYER_MANAGER_MODE.md`. Rejected: full 90-minute v0.1 as the canonical mode.

## 2026-04-30 — User-player on-field intent uses six toggles plus demand-ball action
When the user-player is on the pitch, broad tactical controls remain frozen, but the user gets direct personal intent controls: up to 3 persistent toggles from killer pass, take it on yourself, get forward, sit deeper, press the ball, and aggressive tackle, plus 3 uses per half of demand the ball. Rationale: this preserves the Player Manager state-machine tradeoff while giving on-pitch play agency that is concrete and engine-mappable. Diving/simulation is deferred because it requires wrapper-side contact-in-box detection and award/booking adjudication. See `PLAYER_MANAGER_MODE.md`.

## 2026-04-30 — Attribute derivation retries include validation feedback
Phase B Step 2B added adaptive retry for LLM-derived player attributes: if structured output parses but fails position/tier validation, the retry includes the validation reasons. Without this, roughly 5 of 49 players would have failed deterministic validation on the first pass. Rationale: the model can correct specific rubric misses cheaply, while a hard fail would force unnecessary manual edits. Rejected: silently accepting invalid ratings or retrying without telling the model what failed.

## 2026-04-30 — Goalkeeper validation uses GK-specific bands, not outfield headline counts
Step 2B exposed contradictory goalkeeper wording in `docs/prompt_rubric_draft.md`: outfield headline-count thresholds conflicted with the GK-specific saving/perception/jumping bands. The rubric and validator now treat headline counts as outfield-only. Goalkeepers use saving tier bands and GK-relevant perception, jumping, and agility floors. Rationale: otherwise valid keepers fail because they are not supposed to have many high outfield attributes.

## 2026-04-30 — Derivation readiness uses populated profiles, not edited flags
Attribute derivation pre-flight treats a profile version as ready when required profile fields are populated and not failed. It does not require every player profile to have `edited=true`. Rationale: "curated" is a version workflow signal (forked, named, activated), while `edited` is a granular per-player signal meaning a human touched that specific profile. Activating a curated fork should not force fake edited flags across every row.

## 2026-04-30 — Attribute derivation reads rubric from disk at runtime, not embedded
The LLM system prompt for attribute derivation is the contents of
docs/prompt_rubric_draft.md, loaded at the start of each derivation
run. This means rubric revisions don't require code changes — edit
the doc, fork to a new dataset version, re-derive. Rejected:
embedding the rubric in TypeScript (would couple rubric edits to
deploys; would require tests to be rewritten on every rubric
revision).

## 2026-04-29 — v0.1 includes Player Manager mode (single mode, mandatory player creation)
v0.1's core gameplay is "Player Manager": user creates their own player upfront with a budget-constrained attribute spread (5% above best player's total, configurable), picks from 8 archetype presets or blank slate, and joins Liverpool's squad. Tactical control depends on whether the user-player is on the pitch — full manager mode when off, frozen tactics + sub-self-off as the only action when on. There is no separate "manager only" mode; users who don't want to play themselves simply don't pick themselves in the XI or come off the bench. Rejected: two parallel modes (would have doubled UI surface for marginal benefit). Rejected: optional player creation (would have added branching everywhere for a feature most users would engage with). Scope expansion accepted: v0.1 ships ~30-40% later than manager-only would have. See PLAYER_MANAGER_MODE.md.

## 2026-04-29 — Player attribute budget is configurable, not hardcoded
The user-player's total attribute budget is a multiple of the best in-game player's total. Default multiplier 1.05 (5% above best), with per-attribute caps and floors. All values are configurable in `packages/data/src/config/player-budget.ts` for tuning during testing. Range supported: 0.8x to 1.5x for stress-testing different power levels. Not exposed to users — internal tuning knob.


## 2026-04-29 — Engine smoke test is deterministic via seeded `Math.random`
The smoke test in packages/engine/test/match-smoke.test.ts mocks
Math.random with a seeded LCG to produce a reproducible match each run.
This trades distributional realism for test stability — we'd rather have
a deterministic pass/fail than a flaky test that fails one run in twenty
when randomness conspires against us. Realism validation across seeds
is tracked separately as a backlog item (engine realism characterisation
test). Rejected: probabilistic assertions with statistical bounds (would
add noise without catching real bugs at v0.1).

## 2026-04-29 — v0.1 is text-only; match state stream preserves full positional data for v0.2 renderer
v0.1 ships with a commentary-only UI (no pitch view) — the radio-broadcast aesthetic is intentional, and the LLM commentary thesis must carry the experience without visual crutches. But the server's match state stream preserves the engine's full per-iteration positional payload (player x/y, ball x/y/z, per-player deltas) so v0.2 can add a 2D top-down pitch renderer as a pure additive frontend change. v0.3+ layers event overlays (pass arrows, shot arcs, heatmaps) on top. Pseudo-3D / FM-style match view is out of scope at all versions. Rejected: stripping the v0.1 stream down to events-only (would force a server refactor at v0.2).

## 2026-04-29 — Wrap, don't fork `footballsimulationengine`
Adopt as npm dependency, build typed adapter layer above. Aligned with upstream improvements; small enough to fork later if upstream goes dark. Rejected: forking immediately (permanent maintenance debt) and writing our own engine (huge scope, no payoff for v0.1).

## 2026-04-29 — Scope v0.1 to a single match (the 2005 CL final)
"Istanbul: The Game". One Liverpool vs Milan match, fully realised. If this match doesn't feel magical, the project doesn't continue. Rejected: full Liverpool campaign as v0.1 (too much scope before validating the magic moment).

## 2026-04-29 — Gemini 3 family for LLM, swappable TTS provider
Gemini 3 Flash for per-event commentary, Gemini 3.1 Pro for set-piece moments (pre-match, half-time, full-time, decisive moments). TTS provider abstraction from day one — Gemini TTS as default during dev, ElevenLabs as A/B comparison near v0.1 ship. Rejected: locking to a single TTS vendor early (voice quality is the sensory hook, worth treating as tunable).

## 2026-04-29 — Project name "The Atatürk", repo name `the-ataturk`
Display name with diacritic, repo without (cleaner, no encoding issues). Named after the Atatürk Olympic Stadium in Istanbul where the 2005 final was played.

## 2026-04-29 — Defer Vercel deployment until v0.1 demo time
Repo on day one (enables direct GitHub tooling, better than zip handoffs). Vercel deferred — Node backend with streaming + audio + game state has Vercel-specific gotchas worth thinking through with a working local app, not before.

## 2026-04-29 — Monorepo with workspaces
Clean separation of engine wrapper / tactics / commentary / TTS as packages. Useful for testing and (potential) reuse. Layout in `ARCHITECTURE.md`.
