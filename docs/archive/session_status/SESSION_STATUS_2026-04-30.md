# The Atatürk — Project Status Reference

**Snapshot date:** 30 April – 1 May 2026 (multi-session arc)
**Initial snapshot:** 30 April 14:50 SAST. **Last updated:** 1 May 15:47 SAST.
**Purpose:** Reference doc for post-compaction context. Captures all material decisions, current state, and active work as of this moment.

---

## Project identity

A hobby football management game centred on the 2005 UEFA Champions League final between Liverpool and Milan, built for the Six Crazy Minutes (SCM) Liverpool fan forum. ~30+ hours of work since empty repo, AI-driven dev workflow (Codex GPT-5.4 primary, Gemini 3.1 Pro Preview and Claude Code Sonnet 4 as backups).

Repo (public): `github.com/Mo-Mia/the-ataturk`  
Local dev: `/media/mo/Projects/Active_Dev_Projects/2026-the-ataturk` (Linux Mint)

## Major architectural decisions (newest first)

- **1 May 2026**: Match-engine responsiveness gate passed; all pre-declared tactical/player-impact thresholds cleared and v2 100-seed score-distribution stress test passed
- **1 May 2026**: v2 attribute bridge sprint completed (full FC25-mirror schema accepted, v2→v1 adapter, engine internals stay on v1, weak-foot-aware preferred-foot logic added)
- **1 May 2026**: Event vocabulary expansion completed (cause taxonomy on possession_change, new pass event type, shot/save/foul detail enrichment)
- **30 April 2026**: Custom match engine built and calibrated (multi-stage stochastic, possession-zone state, 3-second ticks)
- **30 April 2026**: Path B chosen (custom engine, not fork-and-tune existing) after two senior-architect investigations
- **30 April 2026**: Engine treated as standalone work, decoupled from The Atatürk's game-specific layers
- **30 April 2026**: 5-sub bend agreed for v0.1 (modern UEFA rule, acknowledged in lore with a wink)
- **30 April 2026**: Second-half-only pivot (game starts at half-time whistle, score 0-3, 90 seconds at HT for tactics)


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
- Patches managed via `patch-package` for FOOTBALLSIMULATIONENGINE only — the new custom engine doesn't need patches

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

### Custom match engine + visualiser (built 30 April – 1 May)
- Standalone `packages/match-engine/` workspace package, written from scratch in TypeScript
- Possession-zone-based state model, 3-second fixed ticks, 900 ticks/half
- Multi-stage stochastic action resolution per tick (movement → possession → pressure/tackle → carrier action → events)
- Linear attribute scaling, 6 tactical levers (formation/mentality/tempo/pressing/lineHeight/width)
- Central calibration file at `packages/match-engine/src/calibration/probabilities.ts`
- 5-pass calibration converged to all targets:
  - Shots 8.38 (target 8-12)
  - Goals 1.34 (target 1-3)
  - Fouls 4.80 (target 4-8)
  - Cards 1.20 (target 1-3)
  - No outcome >40% in score distribution; healthy variance across 50 seeds
- Snapshot-replay visualiser at `/visualise` route, plain SVG, no animation polish
- Goal celebration state machine (4-tick pause, ball reset, conceding team kicks off)
- Wing positioning discipline (lateral anchors, 85/15 wide players, 55/45 central)
- Movement smoothing (60-pitch-unit cap per tick on player movement)
- Dead-ball restarts with players migrating into shape before play resumes
- Throw-ins and goal kicks emit as semantic events; second-yellow now sends off
- Shot-distance bands (close/box/edge/far/speculative) with appropriate save weighting
- Rich event vocabulary expansion (1 May): possession_change with cause taxonomy, shots with type/foot/distance/pressure, saves with quality/result, fouls with severity/location/tackleType, NEW pass event with selective emission
- 0% match outcome drift across event vocabulary expansion (deterministic snapshots preserved)
- v2 attribute bridge sprint (1 May): FC25-style PlayerInputV2 accepted at the engine boundary, adapted to v1 internally, v2 metadata preserved on snapshot rosters, preferred-foot/weak-foot logic applied only for v2 inputs
- v1 compatibility verified byte-identical on representative snapshot diff and unchanged on 50-seed characterisation
- v2 rated-foot characterisation passed targets; latest 100-seed stress test: shots 8.02, goals 1.18, fouls 5.12, cards 1.33, max score share `0-3` at 33%
- Post-v2 UAT refinement landed: goal/full-time states, second-yellow send-offs, wide carries, crosses/cutbacks, ball-side shifting, attack momentum support runs, visualiser heatmap, and momentum diagnostics
- Responsiveness harness passed all thresholds: mentality, pressing, tempo, single-player attribute boost, and test-only 60-minute swap all moved the intended metrics
- Two UAT cycles run with Gemini UAT agent; structured feedback loop established

### Atatürk integration: parked
Existing v0.1 text-only `/match` route still uses old `footballsimulationengine` v4.0.0 with patch. New engine is decoupled and now responsiveness-tested. Atatürk's game-specific layers (half-time builder, intent toggles, lore framing, commentary, TTS) are the next integration planning surface; the old route should not be modified in place.


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

## The engine problem (history and resolution)

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
3. **Visualiser scope (built)**: ugly-but-functional — plain SVG, numbered circles, basic pitch lines, snapshot-replay only. Aesthetic polish (Direction 2 BBC Sport restrained) is a deferred future sprint.
4. **Determinism**: seeded RNG, same approach as existing characterisation script
5. **Targets** (across 50 seeds):
   - 8-12 shots per second-half
   - 1-3 goals per second-half
   - 4-8 fouls per second-half
   - 1-3 cards per match

## Engine adapters (current state)

### Old engine (still active in /match route)
The legacy adapter (`packages/engine/src/engine/adapter.ts`) wraps third-party `footballsimulationengine` v4.0.0:
- `initiateGame(team1, team2, pitch): Promise<MatchDetails>`
- `playIteration(matchDetails): Promise<MatchDetails>`
- `startSecondHalf(matchDetails): Promise<MatchDetails>`

Used by the existing /match route. Will be replaced when Atatürk integrates the new engine.

### New custom engine
The custom match engine (`packages/match-engine/`) public API:
- `simulateMatch(config: MatchConfig): MatchSnapshot` — synchronous full-match simulation
- `simulateMatchStream(config, options)` — async generator for live SSE
- Accepts MatchConfig with Team[home, away], duration ('full_90' | 'second_half'), seed, optional preMatchScore, preMatchStats, rosters

Per Gemini's integration map: three files in the existing codebase are behaviour-dependent on the OLD engine and would need rework when migrating Atatürk to the new engine:
- `server/src/match/half-time-state.ts` (mutates old engine internals)
- `server/src/match/events.ts` (diffs old engine statistics structure)
- `server/src/match/characterise.ts` (mutates old engine player skills directly)

Other coupling (orchestrator, SSE route, frontend) is largely adapter-shaped and will swap cleanly.

## Forum state

- Forum still mostly quiet; no actionable feedback to triage. Last visited 1 May 10:45 SAST.

## What we're doing NOW (1 May 2026)

Closing the post-v2 engine refinement and responsiveness cycle, then preparing for the next sprint.

**Just completed:**
- Rich event vocabulary expansion sprint (possession_change cause taxonomy, pass events with selective emission, shot/save/foul detail enrichment)
- v2 attribute bridge sprint landed with v1 byte-identical preservation
- UAT-driven realism work landed: goal/full-time state, second-yellow send-offs, wide carries, crosses/cutbacks, off-ball shifting, attack momentum support, and heatmap diagnostics
- Momentum and possession streak are now exposed in snapshot ticks and the visualiser heatmap overlay
- Responsiveness gate passed:
  - mentality moved Liverpool shots by 151.61%
  - pressing moved Liverpool fouls by 180.49%
  - tempo moved possession-streak length by 15.80% magnitude
  - Smicer +15 single-player boost moved Liverpool goals by 157.14%
  - test-only 60-minute attribute swap moved four post-60 metrics by >=10%
- v2 100-seed score-distribution stress test passed; max final-score share is 33%

**Next engine/game work:**
- Plan Atatürk integration with the standalone match engine
- Define the real substitution API; do not reuse the responsiveness harness's `__testApplyMidMatchAttributeSwap`
- Decide Player Manager protagonist tuning and involvement model
- Commentary layer (LLM-driven, Marlow & Pearce voices)
- TTS layer
- Match HUD design (Direction 2 BBC Sport restrained styling)
- Pre-match flow (dressing room, team talk, sub bank, sub-self-on)

**Pacing**: engine maturity gate is now cleared. Next work should be integration planning and commentary/TTS, with movement changes limited to specific UAT findings.

**Realistic v0.1 ship**: still 1-2 weeks of focused work, now mostly contingent on Atatürk integration, commentary/TTS, and frontend game-flow work landing cleanly.

## Active backlog highlights

- Atatürk integration with standalone match engine
- Real substitution API for game integration
- Player Manager protagonist tuning and involvement model
- Re-verify match-engine calibration when first real FC25-distributed v2 dataset lands
- Commentary layer with Marlow & Pearce voices
- TTS layer (Gemini TTS or ElevenLabs) — provider-swappable
- Movement strategy refactor before the next major movement feature
- Visualiser polish (Direction 2 BBC Sport restrained aesthetic) — deferred styling sprint
- Squad-swap mechanic as v0.1 unlock (after first canonical win, swap up to 3 Liverpool↔Milan players, no swap costs)
- Diving/simulation toggle (v0.1.5+, requires wrapper-side contact-in-box detection)
- Penalty shootout result fields in fixtures table
- Pirlo penalty_taking calibration concern (LLM gave him 92, higher than real-world expectation)
- Persistent player progression v0.2+
- SkillRating string→number normalisation
- Half-time historical state (exact stats decision deferred)
- Extract shared types package (when API duplication grows)
- Reference: GallagherAiden's footballsimulationexample + worldcup2018simulator for v0.2 visual ref

## Session-specific context worth preserving

- Mo's pace: ~30 hours from empty repo to current state including custom engine and visualiser. Realistic v0.1 ship: 1-2 weeks at this rate.
- UAT workflow: Mo records gameplay sessions with Kazam (screen + microphone audio narration). Gemini 3.1 Pro Preview agent in AI Studio acts as UAT analyst, transcribing audio verbatim and producing structured feedback reports. Two cycles completed; reports valuable for triage.
- Dev agents: Codex (primary), Gemini 3.1 Pro Preview in Antigravity Plan Mode (analysis/diagnostic tasks), Claude Code Sonnet 4 (backup). Gemini has shown a tendency to dive into edits without authorisation; mitigate via Plan Mode.
- Repo recently flipped from public to private and back per Mo's preference

## Communication conventions

- Doc files: UPPERCASE_UNDERSCORE for canonical (BRIEF, ARCHITECTURE), lowercase_underscore for working drafts
- DECISIONS.md is append-only, newest at top
- Substantial prompts have a clear ROLE / CONTEXT / SCOPE / WORKFLOW / DELIVERABLE structure
- Plans reviewed before code; corrections explicit, not unilateral

---

## Honest project status

Custom match engine is real, calibrated, producing watchable football, and responsive to tactics/player quality. Vocabulary is rich. UAT pipeline functional. Engine has reached standalone-product quality independent of The Atatürk.

Two paths remain converging:
- standalone engine → Atatürk integration
- Atatürk integration sprint sequence → v0.1 game ship

Current decision: engine maturity gate cleared. Move to Atatürk integration planning without modifying the legacy `/match` route in place.

Mo has stayed disciplined throughout — plan-then-execute, no premature integration, willing to pivot when needed (engine standalone, FC25 schema, bridge approach).
