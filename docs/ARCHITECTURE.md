# The Atatürk — Architecture & Technical Decisions

> Companion to `PROJECT_BRIEF.md`. Captures the technical decisions made during planning, with rationale. New decisions get appended; existing ones get versioned, not silently rewritten.

## Stack at a glance

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Vite + React + TypeScript | Mo's daily stack; fastest dev loop |
| Match engine | Legacy `/match`: `footballsimulationengine`; standalone package: `@the-ataturk/match-engine` | Existing game route remains stable while the custom engine matures independently |
| Backend | Node | Engine is Node-native; one language across stack |
| Database | SQLite | Zero-config local dev; right shape for portable saves |
| LLM (per-event commentary) | Gemini 3 Flash (`gemini-3-flash-preview`) | Pro intelligence, Flash price; free tier |
| LLM (set-piece moments) | Gemini 3.1 Pro (`gemini-3.1-pro-preview`) | <10 calls per match for high-value content |
| LLM (utility/fallback) | Gemini 3.1 Flash-Lite | Cheap option if cost/volume becomes an issue |
| TTS (default) | Gemini TTS | Single-vendor; cheaper for dev iteration |
| TTS (premium) | ElevenLabs | Higher quality; A/B test near v0.1 ship |
| Hosting | Vercel | Mo's existing setup; defer until v0.1 demo time |
| IDE | Antigravity | Mo's daily |
| Lead dev agent | Codex CLI (GPT-5.4) | Primary implementer |
| Backup dev agent | Claude Code 4.6 | Second-opinion / sanity checks |

## Match engines

The project currently has two match-engine paths:

- **Legacy Atatürk route**: `/match` still uses `packages/engine`, the typed wrapper around `footballsimulationengine`. This keeps the playable vertical slice stable.
- **New standalone engine**: `packages/match-engine` is the custom TypeScript engine used for snapshot generation, visualiser replay, calibration, and future Atatürk integration.

Integration of the new engine into the game-specific `/match` route remains deliberately separate from the legacy route. The standalone engine has now passed calibration and responsiveness testing; the next architectural step is planning the Atatürk-specific integration layer rather than modifying the old route in place.

### Legacy engine: wrap, don't fork

`footballsimulationengine` (Aiden Gallagher, MIT, v5.0.0 March 2026) is the foundation. Three-function API:

- `initiateGame(team1, team2, pitch)` — sets up the match
- `playIteration(matchDetails)` — advances one tick
- `startSecondHalf(matchDetails)` — switches sides

We **wrap** rather than **fork**:

- Adopt the npm package as a dependency. We don't modify it.
- Build a TypeScript adapter layer (`src/engine/adapter.ts`) that exposes typed wrappers and our domain concepts on top.
- If we need engine changes, contribute upstream rather than diverging. Bus factor is mitigated by the fact that the engine is small (~thousands of LOC, single repo) — if upstream goes dark, we can fork at that point.

### Why not fork
Forking buys flexibility now at the cost of permanent maintenance debt. Wrapping keeps us aligned with upstream improvements (and there have been real ones — v5 fixed multiple-ball-action bugs) and forces us to push our value-add into the layers above.

### Iteration → match time mapping
The engine doesn't have a built-in 90-minute clock. We define the mapping ourselves. Initial proposal: **1 iteration = 6 seconds of match time, 900 iterations per match**. Tunable based on what produces good commentary pacing — too many iterations and commentary feels twitchy; too few and the sim loses fidelity.

For v0.1, the match starts at half-time rather than kickoff. `ITERATIONS_PER_HALF` effectively becomes `ITERATIONS_FOR_MATCH`: the playable canonical segment is one 45-minute half, currently 450 iterations, plus extra time and penalties if the second half produces parity. The match state is pre-populated with the historical first-half score and context: Liverpool 0-3 Milan, Maldini 1', Crespo 39', Crespo 44', and plausible first-half shot/possession statistics. The engine still runs by repeated `playIteration` calls; the wrapper/orchestration layer owns the historical state injection.

### Custom engine boundary

The custom engine exposes `simulateMatch(config)` for deterministic snapshot generation and `simulateMatchStream(config, { signal })` for future SSE integration. It uses 3-second ticks, 900 ticks per half, possession-zone state, calibrated stochastic action resolution, and emits rich semantic events plus positional snapshots for the visualiser.

The engine boundary accepts both:

- **v1 players**: the current 10-attribute schema used by The Atatürk's existing data.
- **v2 players**: FC25-style attributes, preferred foot, weak-foot rating, skill-moves rating, and GK-specific attributes.

The bridge architecture keeps engine internals on the calibrated v1 schema. V2 inputs are adapted to v1 at initialisation, while full v2 metadata is preserved on snapshot rosters for future commentary/UI consumers. Preferred-foot logic is the only v2 field currently consumed directly by match resolution.

Snapshot ticks also expose diagnostic state that downstream consumers should not have to infer:

- `attackMomentum: { home: number; away: number }`
- `possessionStreak: { teamId: 'home' | 'away' | null; ticks: number }`

Momentum is intentionally kinematic-only: it influences support runs and team shape, but it does not directly modify shot or goal probabilities. This keeps pressure visible and narratable without creating runaway scoring feedback loops.

The package includes two development harnesses:

- Characterisation scripts for 50/100-seed calibration and score-distribution checks.
- A responsiveness harness that varies one tactic or player-quality input at a time. Its scripted `__testApplyMidMatchAttributeSwap` helper is test-only and is not a substitution API for Atatürk integration.

## Tactics layer (we build this)

The engine has player-level `action` overrides and team-level binary `intent` (`'attack'` / `'defend'`). That's a starting point, not a tactics system. Our layer:

- **Formation** — translates 4-4-2 / 4-3-3 / 3-5-2 / etc. into player `currentPOS` start positions
- **Mentality** — five-step scale (very defensive → very attacking) that modulates `intent` over the match and biases player position offsets
- **Tempo** — affects pass/shoot probability multipliers and player run/sprint frequency
- **Pressing** — affects how aggressively defending players close down ball-carriers
- **Per-player role** — e.g. "deep-lying playmaker," "target man," "ball-winning midfielder" — biases the action override probability table for that player

The tactics layer sits between the user's UI choices and the engine's iteration loop. Each iteration, we apply current tactics state to the match details *before* calling `playIteration`.

### Current state (v0.1 vertical slice)

`packages/tactics` currently implements **formation translation only**: `applyFormation(team, formation)` maps positional templates to player `currentPOS` arrays. Supported formations: 4-4-2 (Liverpool) and 4-3-1-2 (Milan). Mentality, tempo, pressing, and per-player roles are future work.

## Commentary architecture

Two services, swappable via interface, decoupled from each other:

```
EventStream → CommentaryService → text → TTSService → audio
```

### Event abstraction

The engine's iteration log is too low-level for direct LLM input ("Closest Player to ball: X" every iteration is not narratable). We add a layer that:

1. Consumes the per-iteration `iterationLog` and statistics deltas
2. Detects significant events (shot taken, save made, foul, card, goal, possession change in dangerous areas, sustained pressure)
3. Emits **semantic events**: `{ type: 'shot', shooter: 'Gerrard', from: 'edge_of_box', save: true, time: '23'}` etc.
4. Batches every 3–5 semantic events for the commentary LLM

### Commentary service

Provider-swappable interface. Default Gemini 3 Flash for per-batch, escalates to Gemini 3.1 Pro for:
- Pre-match build-up
- Half-time analysis
- Full-time report
- Decisive moments (goals, red cards, late equalisers)

Critical implementation notes:
- **Default temperature 1.0**, do not override (Gemini 3 docs are explicit — lowering causes loops)
- **Thinking level**: `"low"` or `"minimal"` for per-event; `"high"` for set-pieces
- **Streaming**: per-batch responses streamed to frontend so commentary feels live, not pre-baked

### TTS service

Provider-swappable from day one. Gemini TTS as default during dev. ElevenLabs available for A/B testing voice quality. Important: **decouple text generation from speech synthesis** — commentary text is the source of truth, audio is a derivative artefact. Replays, voice changes, and skip-TTS dev mode all become easy.

## Match state streaming and the future renderer

Even though v0.1 is text-only (commentary feed, no pitch view), the match state delivered to the client must include the full positional payload from the engine — every player's `currentPOS`, the ball's `[x, y, z]` position, and any per-iteration deltas. Do **not** strip down the engine output to "just events" for v0.1.

### Why this matters now
v0.2 will add a 2D top-down pitch renderer (SVG-based, smooth interpolation between iterations). That renderer is purely a *new client-side consumer* of the same stream commentary already uses — no backend changes, no new endpoints, no engine refactor. This works only if the v0.1 stream already carries the data the renderer needs.

If we optimise the v0.1 stream down to the minimal shape commentary requires, we pay for the optimisation twice: once now, and again when v0.2 forces us to widen it.

### What the stream contains, per iteration
- Match clock (computed from iteration number)
- Ball state: `position: [x, y, z]`, `withPlayer`, `withTeam`, `direction`
- Both teams: full player array including `currentPOS`, `hasBall`, `action`, `fitness`, per-player `stats` deltas
- Team-level statistics deltas (goals, shots, corners, fouls, etc.)
- The engine's raw `iterationLog` (input to the event abstraction layer)
- Any semantic events extracted in this iteration

### Renderer roadmap (informational, not v0.1 work)
- **v0.1** — text-only. Commentary feed in chat-like UI. The radio commentary aesthetic is the design goal, not a limitation.
- **v0.2** — 2D top-down pitch (SVG, ~22 dots + ball, smooth tweening between iteration positions). Optional initials on dots. Toggleable trails / heat overlay.
- **v0.3+** — Event overlays: pass arrows, shot trajectories rendered as 2D arcs using the engine's z-axis data, possession heatmap toggle, formation shape lines. All additive on top of the v0.2 base.
- **Out of scope, all versions** — pseudo-3D / FM-style rendered match view, kit textures, animated player models. Licensing and scope landmines we explicitly excluded.

### Implementation note for Codex
When designing the server's match state response shape, default to passing through the engine's `matchDetails` object as-is (after type-casting through our adapter). Don't project it down. The exception is the `iterationLog` truncation in the smoke-test endpoint specifically, which is a smoke-test pragmatism, not a design pattern.

## Data layer

SQLite. Schema (v0.1, expand later):

- `clubs` — id, name, country, primary_kit, secondary_kit, manager_real (e.g. "Rafael Benítez")
- `players` — id, club_id, name, position, attributes (JSON, mapped to engine schema), height, fitness, real_player_id (for traceability)
- `fixtures` — id, home_club_id, away_club_id, match_date_real, leg, round (group/r16/qf/sf/final)
- `saves` — game state snapshots for save/load (v0.2+)

For v0.1 (Istanbul only), we hardcode two squads (Liverpool, Milan) and one fixture. Database is overkill but worth setting up cleanly so v0.2 doesn't need a refactor.

### Player profile and attribute derivation

Real attribute ratings (FM-style) are not legally available. We derive our own from the canonical research document and human curation:

- Step 2A extracts player profiles with Gemini 3 Flash: tier, 2004/05 role, and qualitative descriptor.
- The admin UI lets Mo fork profile versions, activate them, and hand-edit individual profiles.
- Step 2B derives the 10 engine attributes from the active profile version and `docs/prompt_rubric_draft.md`, loaded from disk at runtime.
- Position-specific validation checks the LLM output before it is persisted; transient failures and validation failures retry once, then mark the player failed and continue.
- Final ratings live in named dataset versions. The engine consumes the active dataset version.

This is a **LLM-assisted, human-curated** process, not a scrape and not a black box. The LLM creates the first pass; the admin tool preserves version history and manual override.

## File / module layout

```
the-ataturk/
├── apps/
│   └── web/                    # Vite + React frontend
│       ├── src/
│       │   ├── admin/          # Admin tooling UI
│       │   ├── match/          # Match playback page + SSE client
│       │   │   ├── MatchPage.tsx
│       │   │   └── api.ts      # Browser-safe match types + SSE parser
│       │   ├── components/
│       │   └── lib/api.ts      # Backend client (admin)
│       └── package.json
├── packages/
│   ├── engine/                 # Wrapper around footballsimulationengine
│   │   ├── src/index.ts        # Re-exports: initiateGame, playIteration, startSecondHalf
│   │   └── src/internal/       # silence.ts (console muting for engine noise)
│   ├── tactics/                # Formation translation (4-4-2, 4-3-1-2)
│   │   └── src/index.ts        # applyFormation(team, formation)
│   ├── data/                   # SQLite schema, seed scripts, player derivation
│   ├── commentary/             # LLM service + provider abstraction (future)
│   └── tts/                    # TTS service + provider abstraction (future)
├── server/                     # Node backend (Fastify)
│   └── src/
│       ├── match/              # Match orchestration
│       │   ├── half-time-state.ts   # Build MatchDetails from DB + engine
│       │   ├── orchestrator.ts      # Async generator: 450 iterations
│       │   ├── events.ts            # Semantic event extraction (deltas)
│       │   └── run-smoke-match.ts   # Original smoke test runner
│       ├── routes/
│       │   ├── match.ts        # POST /api/match/run (SSE)
│       │   └── smoke-match.ts  # POST /api/smoke-test/match
│       └── config.ts
├── docs/
│   ├── ARCHITECTURE.md         # The 'how' (this doc)
│   ├── DECISIONS.md            # Append-only decision log
│   ├── PROJECT_BRIEF.md        # The 'what'
│   ├── LORE.md                 # The 'why' (narrative fiction)
│   └── BACKLOG.md              # Non-blocking follow-up work
└── README.md
```

Monorepo with workspaces. Keeps engine/tactics/commentary as cleanly separable packages — useful for testing and (eventually) potential reuse.

## Vercel deployment considerations (deferred)

**Don't deploy until we have something to deploy.** When we do:

- **Streaming responses**: Vercel functions support streaming, but timeouts apply (60s on Hobby, 300s on Pro). A 90-minute match cannot run server-side as a single function call. Two architectures to choose between:
  1. **Client-side match loop**: match runs in the browser, commentary/TTS calls go out per batch. Simpler, scales to any duration, but means the engine + tactics ship to the client (bundle size, IP exposure).
  2. **Stateful server with persistent match**: match state in Redis or similar; tick driven by a scheduler or client polling. More complex but cleaner separation.
- **TTS audio handling**: Don't pipe audio through our server. Stream directly from TTS provider to client where possible.
- **API key safety**: Gemini and ElevenLabs keys never reach the client. All LLM/TTS calls go through our backend.

This decision can wait until v0.1 is working locally.

## Testing strategy

For v0.1, prioritise:

- **Engine wrapper unit tests** — given a fixture state, `playIteration` produces expected outputs. Mostly proves our adapter doesn't break anything.
- **Tactics translation tests** — formation X with mentality Y produces expected player positions.
- **Event extraction tests** — given a known iteration log, semantic events are correctly identified.
- **Commentary smoke tests** — sample event batches produce non-empty, coherent text. Hard to test deeper without manual review.

No E2E browser testing for v0.1. Add later.

## Open questions

- Match clock pacing: 6 seconds per iteration, or different? (Validate during day 1 prototyping.)
- Half-time team talk mechanic: free-text input that the LLM interprets, or structured options? (Free-text is more interesting; structured is more controllable. Probably structured for v0.1, free-text v0.2+.)
- Commentator voice selection: at start of match only, or hot-swappable? (Probably start-only for v0.1.)
- Save/load granularity: per-match, or mid-match snapshots? (v0.1 is one match — irrelevant. v0.2 question.)

## Decision log

Decisions get appended to `DECISIONS.md` as one-liners with date and rationale. This document captures the *current* state; that one captures the *trail*.
