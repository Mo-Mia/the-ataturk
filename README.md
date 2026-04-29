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

The server runs on port 8005 and the web app runs on port 5175.

Admin tooling is available locally at `http://127.0.0.1:5175/admin`.

## Checks

```sh
pnpm test
pnpm lint
pnpm typecheck
```

## API Reference

- `GET /api/health`
- `POST /api/smoke-test/match`
- `GET /api/clubs`
- `GET /api/clubs/:id/squad`
- `GET /api/dataset-versions`
- `POST /api/dataset-versions`
- `POST /api/dataset-versions/:id/activate`
- `GET /api/profile-versions`
- `POST /api/profile-versions`
- `POST /api/profile-versions/:id/activate`
- `GET /api/players/:playerId`
- `GET /api/players/:playerId/attributes`
- `PATCH /api/players/:playerId/attributes`
- `GET /api/players/:playerId/attribute-history`
- `GET /api/players/:playerId/profile`
- `PATCH /api/players/:playerId/profile`
- `GET /api/players/:playerId/profile-history`
- `POST /api/profile-extraction/run`

## Documentation

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — what we're building and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical decisions
- [`docs/LORE.md`](docs/LORE.md) — narrative framing
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — append-only decision log

## Stack

Vite + React + TypeScript frontend, Node backend wrapping `footballsimulationengine`, SQLite for state, Gemini 3 family for commentary, Gemini TTS / ElevenLabs for voice. Deployment to Vercel is deferred.

## Licence

TBD. Likely MIT given dependency licences.
