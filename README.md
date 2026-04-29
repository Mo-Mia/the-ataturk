# The Atatürk

A web-based football management game centred on the 2004/05 UEFA Champions League season. Built as a hobby project for the Six Crazy Minutes Liverpool FC forum community.

The hook: AI-driven match commentary (text + voice) that makes a single match feel cinematic.

## Status

Pre-development. Architectural planning phase.

## Documentation

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — what we're building and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical decisions
- [`docs/LORE.md`](docs/LORE.md) — narrative framing
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — append-only decision log

## Stack

Vite + React + TypeScript frontend, Node backend wrapping `footballsimulationengine`, SQLite for state, Gemini 3 family for commentary, Gemini TTS / ElevenLabs for voice. Deployment to Vercel (deferred until v0.1).

## Licence

TBD. Likely MIT given dependency licences.
