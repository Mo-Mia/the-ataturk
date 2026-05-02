# The Atatürk

A web-based football management game centred on the 2004/05 UEFA Champions League season. Built as a hobby project for the Six Crazy Minutes Liverpool FC forum community.

The hook: AI-driven match commentary (text + voice) that makes a single match feel cinematic.

## Status

v0.1 scaffolding in progress. The text-only match playback vertical slice is functional: the second half of the 2005 final streams 450 engine iterations over SSE and renders a live event log at `/match`.

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
Match playback is available at `http://127.0.0.1:5175/match`.

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
- `POST /api/match/run` — SSE stream of second-half match ticks (`?speed=fast` for dev)

## Documentation

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — what we're building and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical decisions
- [`docs/LORE.md`](docs/LORE.md) — narrative framing
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — append-only decision log

## Senior Architect Review Pointers

GitHub directory browsing can be blocked by robots rules in some tools, so use
direct file paths rather than `/tree/` directory URLs.

### Match engine core

- [`packages/match-engine/src/types.ts`](packages/match-engine/src/types.ts)
- [`packages/match-engine/src/engine.ts`](packages/match-engine/src/engine.ts)
- [`packages/match-engine/src/snapshot.ts`](packages/match-engine/src/snapshot.ts)
- [`packages/match-engine/src/state/matchState.ts`](packages/match-engine/src/state/matchState.ts)
- [`packages/match-engine/src/state/initState.ts`](packages/match-engine/src/state/initState.ts)
- [`packages/match-engine/src/state/momentum.ts`](packages/match-engine/src/state/momentum.ts)
- [`packages/match-engine/src/ticks/runTick.ts`](packages/match-engine/src/ticks/runTick.ts)
- [`packages/match-engine/src/ticks/movement.ts`](packages/match-engine/src/ticks/movement.ts)
- [`packages/match-engine/src/ticks/ballPhysics.ts`](packages/match-engine/src/ticks/ballPhysics.ts)
- [`packages/match-engine/src/calibration/probabilities.ts`](packages/match-engine/src/calibration/probabilities.ts)
- [`packages/match-engine/src/calibration/constants.ts`](packages/match-engine/src/calibration/constants.ts)

### Match engine resolution

- [`packages/match-engine/src/resolution/carrierAction.ts`](packages/match-engine/src/resolution/carrierAction.ts)
- [`packages/match-engine/src/resolution/pressure.ts`](packages/match-engine/src/resolution/pressure.ts)
- [`packages/match-engine/src/resolution/actions/pass.ts`](packages/match-engine/src/resolution/actions/pass.ts)
- [`packages/match-engine/src/resolution/actions/shot.ts`](packages/match-engine/src/resolution/actions/shot.ts)
- [`packages/match-engine/src/resolution/actions/tackle.ts`](packages/match-engine/src/resolution/actions/tackle.ts)
- [`packages/match-engine/src/resolution/actions/dribble.ts`](packages/match-engine/src/resolution/actions/dribble.ts)
- [`packages/match-engine/src/resolution/actions/clearance.ts`](packages/match-engine/src/resolution/actions/clearance.ts)

### V2 attribute bridge

- [`packages/match-engine/src/adapter/v2ToV1.ts`](packages/match-engine/src/adapter/v2ToV1.ts)
- [`packages/match-engine/test/adapter/v2ToV1.test.ts`](packages/match-engine/test/adapter/v2ToV1.test.ts)
- [`packages/match-engine/test/integration/v2_input.test.ts`](packages/match-engine/test/integration/v2_input.test.ts)
- [`packages/match-engine/test/resolution/preferredFoot.test.ts`](packages/match-engine/test/resolution/preferredFoot.test.ts)

### Harnesses, scripts, and artefacts

- [`packages/match-engine/scripts/characterise.ts`](packages/match-engine/scripts/characterise.ts)
- [`packages/match-engine/scripts/responsiveness.ts`](packages/match-engine/scripts/responsiveness.ts)
- [`packages/match-engine/scripts/forcedSecondYellow.ts`](packages/match-engine/scripts/forcedSecondYellow.ts)
- [`packages/match-engine/scripts/forcedEarlyGoal.ts`](packages/match-engine/scripts/forcedEarlyGoal.ts)
- [`packages/match-engine/scripts/forcedHighMomentumAttack.ts`](packages/match-engine/scripts/forcedHighMomentumAttack.ts)
- [`packages/match-engine/artifacts/representative-seed-1-v2.json.gz`](packages/match-engine/artifacts/representative-seed-1-v2.json.gz)
- [`packages/match-engine/artifacts/responsiveness-report.json`](packages/match-engine/artifacts/responsiveness-report.json)
- [`packages/match-engine/artifacts/forced-early-goal-v2.json.gz`](packages/match-engine/artifacts/forced-early-goal-v2.json.gz)
- [`packages/match-engine/artifacts/forced-high-momentum-attack-v2.json.gz`](packages/match-engine/artifacts/forced-high-momentum-attack-v2.json.gz)
- [`packages/match-engine/artifacts/forced-second-yellow-v2.json.gz`](packages/match-engine/artifacts/forced-second-yellow-v2.json.gz)

### Visualiser and server support

- [`apps/web/src/match/visualiser/VisualiserPage.tsx`](apps/web/src/match/visualiser/VisualiserPage.tsx)
- [`apps/web/src/match/visualiser/__tests__/visualiser-page.test.tsx`](apps/web/src/match/visualiser/__tests__/visualiser-page.test.tsx)
- [`server/src/routes/visualiser-artifacts.ts`](server/src/routes/visualiser-artifacts.ts)
- [`server/test/visualiser-artifacts.test.ts`](server/test/visualiser-artifacts.test.ts)

### Key tests

- [`packages/match-engine/test/state/initState.test.ts`](packages/match-engine/test/state/initState.test.ts)
- [`packages/match-engine/test/state/momentum.test.ts`](packages/match-engine/test/state/momentum.test.ts)
- [`packages/match-engine/test/ticks/runTick.test.ts`](packages/match-engine/test/ticks/runTick.test.ts)
- [`packages/match-engine/test/resolution/carrierAction.test.ts`](packages/match-engine/test/resolution/carrierAction.test.ts)
- [`packages/match-engine/test/resolution/pressure.test.ts`](packages/match-engine/test/resolution/pressure.test.ts)
- [`packages/match-engine/test/integration/full_match.test.ts`](packages/match-engine/test/integration/full_match.test.ts)
- [`packages/match-engine/test/integration/streaming.test.ts`](packages/match-engine/test/integration/streaming.test.ts)
- [`packages/match-engine/test/integration/scenario_artifacts.test.ts`](packages/match-engine/test/integration/scenario_artifacts.test.ts)

### Canonical docs

- [`docs/SESSION_STATUS_2026-05-01_1506_SAST.md`](docs/SESSION_STATUS_2026-05-01_1506_SAST.md)
- [`docs/UAT_HANDOFF_2026-05-01_PRE_INTEGRATION.md`](docs/UAT_HANDOFF_2026-05-01_PRE_INTEGRATION.md)
- [`docs/MATCH_ENGINE_MODEL_GAPS.md`](docs/MATCH_ENGINE_MODEL_GAPS.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/BACKLOG.md`](docs/BACKLOG.md)

## Stack

Vite + React + TypeScript frontend, Node backend wrapping `footballsimulationengine`, SQLite for state, Gemini 3 family for commentary, Gemini TTS / ElevenLabs for voice. Deployment to Vercel is deferred.

## Licence

TBD. Likely MIT given dependency licences.
