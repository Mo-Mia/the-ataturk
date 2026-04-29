# The Atatürk

A web-based football management game centred on the 2004/05 UEFA Champions League season. Built as a hobby project for the Six Crazy Minutes Liverpool FC forum community.

The hook: AI-driven match commentary (text + voice) that makes a single match feel cinematic.

## Status

v0.1 scaffolding in progress. The current app is a local development harness for proving the match engine can run end to end.

## Prerequisites

- Node.js 20+
- pnpm 10+

## Development

```sh
pnpm install
pnpm dev
```

The server runs on port 3001 and the web app runs on port 5173.

## Checks

```sh
pnpm test
pnpm lint
pnpm typecheck
```

## Documentation

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — what we're building and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical decisions
- [`docs/LORE.md`](docs/LORE.md) — narrative framing
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — append-only decision log

## Stack

Vite + React + TypeScript frontend, Node backend wrapping `footballsimulationengine`, SQLite for state, Gemini 3 family for commentary, Gemini TTS / ElevenLabs for voice. Deployment to Vercel is deferred.

## Licence

TBD. Likely MIT given dependency licences.
