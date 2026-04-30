# The Atatürk — Project Brief

> **Repo name:** `the-ataturk`
> **Display name:** The Atatürk
> **Status:** Phase B Step 2B complete; local-first prototype in progress
> **Owner:** Mo Mia
> **Last updated:** 2026-04-30

---

## What this is

A web-based football management game centred on the 2004/05 UEFA Champions League season. Built for a small community of Liverpool fans on the Six Crazy Minutes (SCM) forum — named after Liverpool's six-minute comeback in the 2005 CL final in Istanbul.

The hook: AI-driven match commentary (text + voice) that makes a single match feel cinematic. Tactical decisions matter. Watching the sim should feel like listening to a live broadcast on the radio.

## Why this scope

The 2004/05 CL is a closed system: 32 clubs, ~30 fixtures (group + knockouts), one final. No transfers, no domestic leagues, no economy. Every match the user plays is a CL match — the matches that anyone remembers anyway. This makes the project tractable as a hobby effort while still feeling complete.

The narrative arc (Liverpool's group-stage struggle → Olympiakos → Juventus → Chelsea → Istanbul) provides a built-in story spine. The MVP question becomes: *can you recreate the miracle, or does your Liverpool crash out?*

## Versions and scope

### v0.1 — "Istanbul"
Single half, fully realised. The 2005 final resumes at half-time: Liverpool 0-3 Milan, 45 minutes already played, Atatürk dressing room, the miracle still unwritten.
- **Player creation** (mandatory): user creates their own reserve player with a configurable points budget, picks an archetype preset, joins Liverpool's matchday squad
- Half-time takeover: Benítez hands control to the user in the dressing room
- Decision window: approximately 90 seconds to give a team-talk, make tactical changes, optionally make substitutions, and decide whether to sub the user-player on for the second half
- Match: second half only by default, with AI commentary (text + voice), tactical sub/shift controls while the user-player is off the pitch
- **Tactical permissions depend on user-player position**: full manager controls when off the pitch; frozen tactics with on-field intent controls and sub-self-off as the escape hatch when on the pitch
- Full-time: match report with user-player narrative beats; extra time and penalties if the second half produces parity

If this match doesn't feel magical, the project doesn't continue. Everything else is built on top of this proven core.

See `PLAYER_MANAGER_MODE.md` for the full specification.

### v0.2 — Full Liverpool campaign
The complete 2004/05 CL run as Liverpool. Group stage through final. Squad/form/injury management between matches. Light training mechanic.

### v0.3 — Choose any club
Same campaign, but the user can pick any of the 32 clubs and play their actual fixtures. AI manages opponent clubs.

### v0.4 — Multiplayer (community mode)
Random club assignment per playthrough for SCM forum members. Async or scheduled-live matches between users. Significant backend work — only attempt once single-player is rock solid.

## Core mechanics (v0.1)

- **Player creation** — mandatory upfront flow; user creates a reserve player with budget-constrained attributes from one of 8 presets (or blank slate)
- **Half-time team talk** — shapes morale/performance modifiers before the second half begins
- **Second-half team selection** — choose whether to keep the historical restart shape, change formation, make substitutions, and optionally spend one substitution to put the user-player on
- **Tactics** — tempo, mentality (defensive → attacking), pressing intensity, per-player role
- **In-match decisions** — substitutions, formation shifts, tactical tweaks while the user-player is off the pitch; on-field intent toggles while they are on it

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
2. Arrive in the Istanbul dressing room at half-time, Liverpool 0-3 Milan
3. Give a team-talk, adjust tactics, and decide whether to put their user-player on for the second half
4. Watch/listen to the second half unfold with AI commentary
5. Make at least one meaningful in-match decision, either as manager or as the user-player on the pitch
6. Get a full-time report that understands the historical first half and the user-authored second half
7. Want to play it again

If six of seven are met and forum reaction is positive, ship v0.2.

## Naming and lore

The project leans into Istanbul. The repo is `the-ataturk` (after the Atatürk Olympic Stadium where the final was played). Display name **The Atatürk**.

The framing fiction: *Rafa Benítez has reached half-time 3-0 down and, in a moment of crisis, hands control to the user: an unknown Liverpool reserve who somehow ended up in the matchday squad. The user has one dressing-room window to talk, change the plan, and decide whether to step onto the pitch.*

## Tech stack (one-line summary)

Vite + React + TypeScript frontend, Node backend wrapping `footballsimulationengine` (npm), SQLite for state, Gemini 3 family for commentary, Gemini TTS or ElevenLabs for voice. Eventual deployment to Vercel.

See `ARCHITECTURE.md` for detail.
