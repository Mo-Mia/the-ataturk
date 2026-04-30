# The Atatürk — Project Status Reference

**Snapshot date:** 30 April 2026, 14:50 SAST  
**Purpose:** Reference doc for post-compaction context. Captures all material decisions, current state, and active work as of this moment.

---

## Project identity

A hobby football management game centred on the 2005 UEFA Champions League final between Liverpool and Milan, built for the Six Crazy Minutes (SCM) Liverpool fan forum. ~30+ hours of work since empty repo, AI-driven dev workflow (Codex GPT-5.4 primary, Gemini 3.1 Pro Preview and Claude Code Sonnet 4 as backups).

Repo (public): `github.com/Mo-Mia/the-ataturk`  
Local dev: `/media/mo/Projects/Active_Dev_Projects/2026-the-ataturk` (Linux Mint)

## v0.1 game concept (locked)

**Second-half-only match.** Game starts at the half-time whistle of the 2005 final. Score is Liverpool 0–3 Milan. User is an unknown reserve who Benítez (having lost faith) hands control to in the dressing room. ~90 seconds at half-time to: give a team-talk, change tactics, make subs, and decide whether to come on for the second half.

User has Player Manager mode: creates their own player upfront with budget-constrained attributes (8 archetypes + blank slate). Tactical control is **conditional on whether user-player is on the pitch**:
- **Off pitch (bench/subbed off):** full manager controls
- **On pitch:** tactics frozen at last setting; only available action is "request substitution off" (costs a sub)

User-player has 6 persistent on-pitch intent toggles (multi-select up to 3): killer pass, take it on yourself, get forward, sit deeper, press the ball, aggressive tackle. Plus 1 resource action: demand the ball (3 uses per half).

Substitution bank: **5 subs (modern UEFA rule)**, with one already used historically (Smicer for Kewell first-half). 4 remaining at half-time. Acknowledged in lore/UI with a wink: "in this telling, you have five subs. Don't ask why. Use them well."

## Tech stack (locked unless engine decision changes things)

- pnpm monorepo with strict TypeScript, en-GB throughout
- Server: Fastify on port 8005, SQLite via `better-sqlite3`, no ORM, plain SQL migrations in filename order
- Frontend: Vite + React on port 5175
- LLM: Gemini 3 Flash (`gemini-3-flash-preview`) via `@google/genai`, temp 1.0, ThinkingLevel.LOW
- TTS: planned (Gemini TTS or ElevenLabs, provider-swappable, not yet built)
- Patches managed via `patch-package` for the engine (until replacement lands)

## Phases completed

### Phase A (data layer)
- Schema migrations under `packages/data/migrations/`
- Tables: clubs, players (with `player_origin` enum 'real'|'user_created'), `player_attributes`, `player_dataset_versions`, `player_attribute_history`, `player_profile_versions`, `player_profiles`, `player_profile_history`, fixtures
- 49 real players seeded (26 Liverpool, 23 Milan; Morientes/Pellegrino excluded as ineligible)
- Liverpool home, Milan away (editorial — neutral venue Atatürk)
- Fixture: `final-2005`, kickoff 2005-05-25T18:45Z

### Phase B (admin tooling, profile extraction, attribute derivation)
- Admin UI under `apps/web/src/admin/` with `/admin` route, dataset version management, profile/attribute CRUD with edit history
- LLM-driven profile extraction (Step 2A): 49 profiles successfully extracted into `v0-empty`, then forked and curated to `v1-curated`
- LLM-driven attribute derivation (Step 2B): 49 attribute rows derived into `v2-llm-derived-final`. All 49 succeeded. Adaptive retry (with validation feedback in second attempt) was needed — without it, ~5/49 would have failed validation
- Per-player profile and attribute editing surfaces in admin UI
- Forum-feedback static HTML page on tinyhost: `https://player-ratings.tiiny.site/`
- SCM forum thread live with three posts: original pitch, Player Manager reveal, second-half pivot announcement. Awaiting feedback (slow trickle expected).

### Vertical slice match (text-only)
- Half-time state builder pre-populates 0-3 score, 45 minutes elapsed, second-half kickoff
- Hardcoded XIs:
  - Liverpool 4-4-2 (XI as at half-time whistle): Dudek, Finnan, Carragher, Hyypiä, Traoré, Gerrard, Xabi, Riise, Smicer, Garcia, Baros
  - Milan 4-3-1-2: Dida, Cafu, Stam, Nesta, Maldini, Gattuso, Pirlo, Seedorf, Kaká, Crespo, Shevchenko
- `packages/tactics/` with `applyFormation()` (formation→position translation only)
- `server/src/match/orchestrator.ts` async-generator iteration loop with SSE
- `server/src/match/events.ts` semantic event extraction (goal/shot/save/foul/card via per-iteration diffing)
- `/match` page in web app with text event log
- DEV-only `?speed=fast` toggle for development; production real-time pace
- Reuses Step 2A/2B SSE+abort patterns

## Documentation state

All canonical docs current as of last commit:
- `docs/PROJECT_BRIEF.md` (v0.1 = second-half-only)
- `docs/ARCHITECTURE.md` (match orchestration, half-time state)
- `docs/DECISIONS.md` (newest at top, includes second-half pivot and engine learnings)
- `docs/BACKLOG.md`
- `docs/PLAYER_MANAGER_MODE.md` (full state machine, intent toggles, curation lifecycle, 5-sub bend)
- `docs/LORE.md` (Benítez handover framing)
- `docs/prompt_rubric_draft.md` (validated against Step 2B output, GK rules clarified)
- `docs/CHARACTERISATION.md`
- `docs/CHARACTERISATION_VARIANTS.md`
- `docs/ENGINE_INTEGRATION_MAP.md` (Gemini's investigation report)

## The engine problem (resolved direction, executing today)

### What was discovered

The third-party `footballsimulationengine` v4.0.0 (used initially) produces severely sparse football:
- 1.2 average shots per second-half (real CL avg: 8-12)
- 0.1 average goals per second-half (real avg: 1-3)
- 0.3 average fouls per match (real avg: 8-15)
- Zero yellow/red cards across 250 test matches across 5 variants
- 88-90% of matches end at 0-3

Tactical configuration variants (intent flips, attribute boosts) had essentially **zero impact** on output. The engine doesn't meaningfully respond to its own intent inputs — they get hardcoded-overridden inside `actions.setPostTackleBall`.

**Bug found and fixed**: Gemini discovered an `if (index)` truthiness bug on `findIndex` results in the engine's `actions.js`. The bug was both crashing matches (4% of runs) AND silently excluding goalkeepers from tackle/discovery logic. Patched via `patch-package`. Verified with console.log injection that the patch is live.

The sparseness is post-patch — bug fix didn't solve the realism issue, just stopped crashes.

### The decision: build a custom engine (Path B)

Two senior-architect investigations (one ChatGPT GPT-5.5 web-only, one Gemini 3.1 Pro Preview with codebase access) independently reached the same conclusion: **build a custom TypeScript match engine.**

Reasons:
- Sparseness is structural (hardcoded probability arrays scattered across many functions in `actions.js`)
- Forking would require effectively rewriting action resolution, with no transferable benefit
- v0.1 scope is narrow enough that a custom engine isn't a giant rewrite
- Mo wants long-term ownership of a bespoke engine for future projects

### Project pivot announced

Engine will be built as **standalone work, decoupled from The Atatürk's game-specific layers.** It lives at `packages/match-engine/` in the current monorepo (extract to its own repo later when there's a second consumer). The Atatürk becomes the *first integration* of the engine, not the engine's reason for existing.

The Atatürk's game-specific work (player creator, intent toggles, half-time team talk, commentary, lore) is **parked** until the engine is solid.

### Key engine design decisions made

1. **Output shape**: tick-based with kinematics (players move continuously, ball physics). Not abstract diagrams; not pure event-stream. Continuous motion punctuated by discrete events.
2. **Engine scope**: mostly generic football engine, with a few Atatürk-leaning concessions (semantic event types compatible with our `extractEvents`, position numbering compatible with existing data).
3. **Visualiser scope**: ugly-but-functional today (plain SVG rectangles, numbered circles, basic pitch lines, snapshot-replay only — no live SSE drive yet, no aesthetic polish). Pretty visualiser tomorrow as a focused styling sprint with Direction 2 BBC Sport restrained aesthetic.
4. **Determinism**: seeded RNG, same approach as existing characterisation script
5. **Targets** (across 50 seeds):
   - 8-12 shots per second-half
   - 1-3 goals per second-half
   - 4-8 fouls per second-half
   - 1-3 cards per match

## Engine adapter contract (currently)

The current adapter (`packages/engine/src/engine/adapter.ts`) exposes:
```typescript
initiateGame(team1: TeamInput, team2: TeamInput, pitch: Pitch): Promise<MatchDetails>
playIteration(matchDetails: MatchDetails): Promise<MatchDetails>
startSecondHalf(matchDetails: MatchDetails): Promise<MatchDetails>
```

Per Gemini's integration map: most of the codebase is well-decoupled from the engine internals through this adapter. Three files have **behaviour-dependent** coupling that would need rework:
- `server/src/match/half-time-state.ts` (mutates engine internals directly)
- `server/src/match/events.ts` (diffs engine statistics structure for events)
- `server/src/match/characterise.ts` (mutates `player.skill.tackling` etc.)

These will need touching when the new engine lands, but the rest of the stack (adapter, orchestrator, SSE route, web frontend) is mostly adapter-shaped and will swap cleanly.

## Forum state

Three posts live on SCM thread:
1. Original pitch ("right, hear me out")
2. Player Manager reveal ("what if you could add yourself")
3. Second-half pivot ("the game starts at half-time")

Plus the static player-ratings page shared. Forum is small, "a few people saying they would play it." No urgent feedback action needed.

## What we're doing NOW (after this doc lands)

Starting the **engine + visualiser design conversation** in this chat. Specifically:

1. Engine architecture design (phase model, tick model, probability framework, tactical hooks, position output strategy, calibration loop)
2. Visualiser scope (snapshot replay, ugly but functional)
3. Then drafting a comprehensive Codex implementation prompt
4. Codex builds engine + visualiser today
5. Tomorrow: aesthetic polish on the visualiser (Direction 2 styling)

After that:
- Re-integrate engine with The Atatürk's game-specific layers (half-time state builder, tactics, characterisation)
- Then commentary layer (LLM-driven Marlow & Pearce voices)
- Then TTS
- Then match HUD design
- Then pre-match flow (dressing room, team talk, sub bank, optional sub-self-on)

Realistic v0.1 ship: 1-2 weeks of focused work given current pace.

## Active backlog highlights

- Squad-swap mechanic as v0.1 unlock (after first canonical win, swap up to 3 Liverpool↔Milan players, no swap costs)
- Diving/simulation toggle (v0.1.5+, requires wrapper-side contact-in-box detection)
- Penalty shootout result fields in fixtures table
- Pirlo penalty_taking calibration concern (LLM gave him 92, higher than real-world expectation)
- Persistent player progression v0.2+
- Engine realism characterisation test
- SkillRating string→number normalisation
- Half-time historical state (exact stats decision deferred)
- Extract shared types package (when API duplication grows)
- Reference: GallagherAiden's footballsimulationexample + worldcup2018simulator for v0.2 visual ref

## Session-specific context worth preserving

- Mo's pace: 22-26 hours from empty repo to current state. Realistic v0.1 ship is 1-2 weeks at this rate.
- Style: plan-then-execute discipline, paste verbatim, single commits per logical unit, en-GB throughout
- Dev agents: Codex (primary), Gemini 3.1 Pro Preview in Antigravity Plan Mode (analysis/diagnostic tasks), Claude Code Sonnet 4 (backup). Gemini has shown a tendency to dive into edits without authorisation; mitigate via Plan Mode.
- Repo recently flipped from public to private and back per Mo's preference

## Communication conventions

- Doc files: UPPERCASE_UNDERSCORE for canonical (BRIEF, ARCHITECTURE), lowercase_underscore for working drafts
- DECISIONS.md is append-only, newest at top
- Substantial prompts have a clear ROLE / CONTEXT / SCOPE / WORKFLOW / DELIVERABLE structure
- Plans reviewed before code; corrections explicit, not unilateral

---

## Honest project status

The hard part — orchestration plumbing, data, LLM derivation, admin tooling — is done and working. The next sprint (engine + visualiser today) is the make-or-break for whether v0.1 produces watchable football. After that, the path to v0.1 is clearer than it's been.
