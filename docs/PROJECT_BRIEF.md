# The Atatürk — Project Brief

> **Repo name:** `the-ataturk`
> **Display name:** The Atatürk
> **Status:** Pre-development, architectural planning phase
> **Owner:** Mo Mia
> **Last updated:** 2026-04-29

---

## What this is

A web-based football management game centred on the 2004/05 UEFA Champions League season. Built for a small community of Liverpool fans on the Six Crazy Minutes (SCM) forum — named after Liverpool's six-minute comeback in the 2005 CL final in Istanbul.

The hook: AI-driven match commentary (text + voice) that makes a single match feel cinematic. Tactical decisions matter. Watching the sim should feel like listening to a live broadcast on the radio.

## Why this scope

The 2004/05 CL is a closed system: 32 clubs, ~30 fixtures (group + knockouts), one final. No transfers, no domestic leagues, no economy. Every match the user plays is a CL match — the matches that anyone remembers anyway. This makes the project tractable as a hobby effort while still feeling complete.

The narrative arc (Liverpool's group-stage struggle → Olympiakos → Juventus → Chelsea → Istanbul) provides a built-in story spine. The MVP question becomes: *can you recreate the miracle, or does your Liverpool crash out?*

## Versions and scope

### v0.1 — "Istanbul"
Single match, fully realised. The 2005 final: Liverpool vs Milan.
- **Player creation** (mandatory): user creates their own player with a configurable points budget, picks an archetype preset, joins Liverpool's squad
- Pre-match: pick the XI (with or without the user-player), set tactics
- Match: AI commentary (text + voice), tactical sub/shift controls
- **Tactical permissions depend on user-player position**: full manager controls when off the pitch; frozen tactics with sub-self-off as the only action when on the pitch
- Half-time: team talk and tactical reset (off pitch) or tunnel-chat dialogue (on pitch)
- Full-time: match report with user-player narrative beats

If this match doesn't feel magical, the project doesn't continue. Everything else is built on top of this proven core.

See `PLAYER_MANAGER_MODE.md` for the full specification.

### v0.2 — Full Liverpool campaign
The complete 2004/05 CL run as Liverpool. Group stage through final. Squad/form/injury management between matches. Light training mechanic.

### v0.3 — Choose any club
Same campaign, but the user can pick any of the 32 clubs and play their actual fixtures. AI manages opponent clubs.

### v0.4 — Multiplayer (community mode)
Random club assignment per playthrough for SCM forum members. Async or scheduled-live matches between users. Significant backend work — only attempt once single-player is rock solid.

## Core mechanics (v0.1)

- **Player creation** — mandatory upfront flow; user creates their player with budget-constrained attributes from one of 8 presets (or blank slate)

- **Team selection** — XI from squad, formation choice (4-4-2, 4-3-3, 3-5-2, etc.)
- **Tactics** — tempo, mentality (defensive → attacking), pressing intensity, per-player role
- **In-match decisions** — substitutions, formation shifts, tactical tweaks at any time
- **Half-time team talk** — shapes player morale/performance modifiers for the second half

Deliberately **not** in v0.1: economy, transfers, training, multi-season, scouting, board interactions, press conferences (other than as AI-generated flavour text), youth academies.

## The AI commentary thesis

This is the differentiator. Old CM commentary was a pre-canned text scroll. Modern FM has had stock commentary forever. The genuine novelty here is:

- **Per-event narration with personality** — choose a commentator voice (English broadcast / Continental / dry analyst)
- **Match context awareness** — commentary references the score, the time, recent events, club rivalries, season narrative
- **Set-piece moments** — pre-match build-up, half-time analysis, full-time report all use a more capable model
- **Voice synthesis (TTS)** — actual audio commentary, not just text

The risk: if the commentary is mid, the game is mid. We must validate this works before building anything else.

## Out of scope, hard

- Real player likenesses, team kit images, stadium photography (legal landmines)
- Real-time multiplayer matches (huge scope)
- Mobile-first design (desktop browser is the target)
- Anything pre- or post-2004/05 season
- Domestic leagues or other competitions in the same season

## Success criteria for v0.1

A SCM forum member can:
1. Open the game in a browser
2. See the Istanbul final teamsheet, choose Liverpool's XI and tactics
3. Watch/listen to a 90-minute match unfold with AI commentary
4. Make at least one substitution and one tactical change
5. Get a full-time report
6. Want to play it again

If five of six are met and forum reaction is positive, ship v0.2.

## Naming and lore

The project leans into Istanbul. The repo is `the-ataturk` (after the Atatürk Olympic Stadium where the final was played). Display name **The Atatürk**.

The framing fiction: *Rafa Benítez can't take charge in Istanbul (reason TBD — see LORE.md). Liverpool need a manager to take the dugout for the most important night in the club's recent history. That's the user.*

## Tech stack (one-line summary)

Vite + React + TypeScript frontend, Node backend wrapping `footballsimulationengine` (npm), SQLite for state, Gemini 3 family for commentary, Gemini TTS or ElevenLabs for voice. Eventual deployment to Vercel.

See `ARCHITECTURE.md` for detail.
