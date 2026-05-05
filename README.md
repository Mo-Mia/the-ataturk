# The Atatürk

A web-based football management game centred on the 2004/05 UEFA Champions League season. Built as a hobby project for the Six Crazy Minutes Liverpool FC forum community.

The hook: AI-driven match commentary (text + voice) that makes a single match feel cinematic.

## Status

Local prototype in active development. The legacy text-only match playback
vertical slice remains functional at `/match`. In parallel, the standalone
TypeScript match engine now drives the FootSim diagnostic workbench: replay at
`/visualise`, FC25 sim runner at `/visualise/run`, persisted run history,
side-by-side comparison, batch distribution analysis, manual XIs, fatigue,
scheduled/manual substitutions, AI Auto Subs, and score-state urgency.

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
Squad Manager is available locally at `http://127.0.0.1:5175/admin/squad-manager`.
Match playback is available at `http://127.0.0.1:5175/match`.
Match-engine replay diagnostics are available at `http://127.0.0.1:5175/visualise`.
The FC25 sim-runner workbench is available at `http://127.0.0.1:5175/visualise/run`.
Persisted run comparison is available at `http://127.0.0.1:5175/visualise/compare`.
Batch distribution analysis is available at `http://127.0.0.1:5175/visualise/batch/:batchId`.

To import the tracked five-club FC25 fixture for workbench smoke testing:

```sh
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/fixtures/male_players_top5pl.csv
```

To import the refreshed FC26 SoFIFA export:

```sh
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/FC26_20250921.csv --format fc26
```

The importer defaults to `--format auto`, with `--format fc25` and
`--format fc26` available as escape hatches when header detection is wrong.
Imports now keep full club squads by default. Use `--cap <number>` only when a
deliberately capped fixture is needed; clubs above 35 imported players emit a
warning but still import.

Squad Manager verification needs these environment variables when calling live
services:

```sh
FOOTBALL_DATA_API_KEY=...
GEMINI_API_KEY=...
```

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
- `GET /api/ai/squad-manager/context`
- `GET /api/ai/squad-manager/squad`
- `POST /api/ai/verify-squad`
- `POST /api/admin/squad-manager/apply`
- `POST /api/admin/squad-manager/dataset-versions/:id/activate`
- `POST /api/match/run` — SSE stream of second-half match ticks (`?speed=fast` for dev)
- `GET /api/visualiser/artifacts`
- `GET /api/visualiser/artifacts/:filename`
- `GET /api/match-engine/clubs`
- `POST /api/match-engine/simulate` — batch-then-load FC25 workbench simulations
- `GET /api/match-engine/runs`
- `GET /api/match-engine/runs/:id`
- `GET /api/match-engine/batches/:batchId/runs`
- `DELETE /api/match-engine/runs/:id`

## Documentation

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — what we're building and why
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical decisions
- [`docs/LORE.md`](docs/LORE.md) — narrative framing
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — append-only decision log
- [`docs/design/STYLE_GUIDE.md`](docs/design/STYLE_GUIDE.md) — Atatürk visual style guide
- [`docs/football-data-api-docs/`](docs/football-data-api-docs/) — saved API documentation for the football-data.org integration

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
- [`packages/match-engine/src/state/stamina.ts`](packages/match-engine/src/state/stamina.ts)
- [`packages/match-engine/src/state/scoreState.ts`](packages/match-engine/src/state/scoreState.ts)
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
- [`packages/match-engine/src/resolution/substitutions.ts`](packages/match-engine/src/resolution/substitutions.ts)

### V2 attribute bridge

- [`packages/match-engine/src/adapter/v2ToV1.ts`](packages/match-engine/src/adapter/v2ToV1.ts)
- [`packages/match-engine/test/adapter/v2ToV1.test.ts`](packages/match-engine/test/adapter/v2ToV1.test.ts)
- [`packages/match-engine/test/integration/v2_input.test.ts`](packages/match-engine/test/integration/v2_input.test.ts)
- [`packages/match-engine/test/resolution/preferredFoot.test.ts`](packages/match-engine/test/resolution/preferredFoot.test.ts)

### FC25 data ingestion

- [`docs/FC25_DATA_MAPPING.md`](docs/FC25_DATA_MAPPING.md)
- [`data/fc-25/fixtures/male_players_top5pl.csv`](data/fc-25/fixtures/male_players_top5pl.csv)
- [`packages/data/migrations/003_fc25.sql`](packages/data/migrations/003_fc25.sql)
- [`packages/data/migrations/004_match_runs.sql`](packages/data/migrations/004_match_runs.sql)
- [`packages/data/src/fc25/constants.ts`](packages/data/src/fc25/constants.ts)
- [`packages/data/src/fc25/parser.ts`](packages/data/src/fc25/parser.ts)
- [`packages/data/src/fc25/adapter.ts`](packages/data/src/fc25/adapter.ts)
- [`packages/data/src/fc25/importer.ts`](packages/data/src/fc25/importer.ts)
- [`packages/data/src/match-runs.ts`](packages/data/src/match-runs.ts)
- [`packages/data/test/fc25/parser.test.ts`](packages/data/test/fc25/parser.test.ts)
- [`packages/data/test/fc25/adapter.test.ts`](packages/data/test/fc25/adapter.test.ts)
- [`packages/data/test/fc25/importer.test.ts`](packages/data/test/fc25/importer.test.ts)
- [`packages/data/test/match-runs.test.ts`](packages/data/test/match-runs.test.ts)

### Harnesses, scripts, and artefacts

- [`packages/match-engine/scripts/characterise.ts`](packages/match-engine/scripts/characterise.ts)
- [`packages/match-engine/scripts/responsiveness.ts`](packages/match-engine/scripts/responsiveness.ts)
- [`packages/match-engine/scripts/forcedSecondYellow.ts`](packages/match-engine/scripts/forcedSecondYellow.ts)
- [`packages/match-engine/scripts/forcedEarlyGoal.ts`](packages/match-engine/scripts/forcedEarlyGoal.ts)
- [`packages/match-engine/scripts/forcedHighMomentumAttack.ts`](packages/match-engine/scripts/forcedHighMomentumAttack.ts)
- [`packages/match-engine/scripts/forcedSubstitution.ts`](packages/match-engine/scripts/forcedSubstitution.ts)
- [`packages/match-engine/scripts/forcedFatigueImpact.ts`](packages/match-engine/scripts/forcedFatigueImpact.ts)
- [`packages/match-engine/scripts/forcedLateComeback.ts`](packages/match-engine/scripts/forcedLateComeback.ts)
- [`packages/data/src/fc25/realSquadResponsiveness.ts`](packages/data/src/fc25/realSquadResponsiveness.ts)
- [`packages/match-engine/artifacts/representative-seed-1-v2.json.gz`](packages/match-engine/artifacts/representative-seed-1-v2.json.gz)
- [`packages/match-engine/artifacts/responsiveness-report.json`](packages/match-engine/artifacts/responsiveness-report.json)
- [`packages/match-engine/artifacts/forced-early-goal-v2.json.gz`](packages/match-engine/artifacts/forced-early-goal-v2.json.gz)
- [`packages/match-engine/artifacts/forced-high-momentum-attack-v2.json.gz`](packages/match-engine/artifacts/forced-high-momentum-attack-v2.json.gz)
- [`packages/match-engine/artifacts/forced-second-yellow-v2.json.gz`](packages/match-engine/artifacts/forced-second-yellow-v2.json.gz)

### Visualiser and server support

- [`apps/web/src/match/visualiser/VisualiserPage.tsx`](apps/web/src/match/visualiser/VisualiserPage.tsx)
- [`apps/web/src/match/visualiser/SimRunnerPage.tsx`](apps/web/src/match/visualiser/SimRunnerPage.tsx)
- [`apps/web/src/match/visualiser/ComparePage.tsx`](apps/web/src/match/visualiser/ComparePage.tsx)
- [`apps/web/src/match/visualiser/BatchDistributionPage.tsx`](apps/web/src/match/visualiser/BatchDistributionPage.tsx)
- [`apps/web/src/match/visualiser/components/StatsPanel.tsx`](apps/web/src/match/visualiser/components/StatsPanel.tsx)
- [`apps/web/src/match/visualiser/components/HeatmapPanel.tsx`](apps/web/src/match/visualiser/components/HeatmapPanel.tsx)
- [`apps/web/src/match/visualiser/components/EventDock.tsx`](apps/web/src/match/visualiser/components/EventDock.tsx)
- [`apps/web/src/match/visualiser/__tests__/visualiser-page.test.tsx`](apps/web/src/match/visualiser/__tests__/visualiser-page.test.tsx)
- [`apps/web/src/match/visualiser/__tests__/sim-runner-page.test.tsx`](apps/web/src/match/visualiser/__tests__/sim-runner-page.test.tsx)
- [`apps/web/src/match/visualiser/__tests__/compare-page.test.tsx`](apps/web/src/match/visualiser/__tests__/compare-page.test.tsx)
- [`apps/web/src/match/visualiser/__tests__/batch-distribution-page.test.tsx`](apps/web/src/match/visualiser/__tests__/batch-distribution-page.test.tsx)
- [`server/src/routes/visualiser-artifacts.ts`](server/src/routes/visualiser-artifacts.ts)
- [`server/src/routes/match-engine.ts`](server/src/routes/match-engine.ts)
- [`server/test/visualiser-artifacts.test.ts`](server/test/visualiser-artifacts.test.ts)
- [`server/test/match-engine/simulate-route.test.ts`](server/test/match-engine/simulate-route.test.ts)

### Key tests

- [`packages/match-engine/test/state/initState.test.ts`](packages/match-engine/test/state/initState.test.ts)
- [`packages/match-engine/test/state/momentum.test.ts`](packages/match-engine/test/state/momentum.test.ts)
- [`packages/match-engine/test/state/fatigue.test.ts`](packages/match-engine/test/state/fatigue.test.ts)
- [`packages/match-engine/test/state/scoreState.test.ts`](packages/match-engine/test/state/scoreState.test.ts)
- [`packages/match-engine/test/ticks/runTick.test.ts`](packages/match-engine/test/ticks/runTick.test.ts)
- [`packages/match-engine/test/resolution/carrierAction.test.ts`](packages/match-engine/test/resolution/carrierAction.test.ts)
- [`packages/match-engine/test/resolution/pressure.test.ts`](packages/match-engine/test/resolution/pressure.test.ts)
- [`packages/match-engine/test/integration/full_match.test.ts`](packages/match-engine/test/integration/full_match.test.ts)
- [`packages/match-engine/test/integration/streaming.test.ts`](packages/match-engine/test/integration/streaming.test.ts)
- [`packages/match-engine/test/integration/scenario_artifacts.test.ts`](packages/match-engine/test/integration/scenario_artifacts.test.ts)
- [`packages/match-engine/test/integration/substitutions.test.ts`](packages/match-engine/test/integration/substitutions.test.ts)

### Canonical docs

- [`docs/SESSION_STATUS_2026-05-03_1301_SAST.md`](docs/SESSION_STATUS_2026-05-03_1301_SAST.md)
- [`docs/SESSION_STATUS_2026-05-03_1103_SAST.md`](docs/SESSION_STATUS_2026-05-03_1103_SAST.md)
- [`docs/SESSION_STATUS_2026-05-01_1506_SAST.md`](docs/SESSION_STATUS_2026-05-01_1506_SAST.md)
- [`docs/UAT_HANDOFF_2026-05-01_PRE_INTEGRATION.md`](docs/UAT_HANDOFF_2026-05-01_PRE_INTEGRATION.md)
- [`docs/MATCH_ENGINE_MODEL_GAPS.md`](docs/MATCH_ENGINE_MODEL_GAPS.md)
- [`docs/FC25_DATA_MAPPING.md`](docs/FC25_DATA_MAPPING.md)
- [`docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md`](docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md)
- [`docs/CHARACTERISATION_FULL_MATCH.md`](docs/CHARACTERISATION_FULL_MATCH.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DECISIONS.md`](docs/DECISIONS.md)
- [`docs/BACKLOG.md`](docs/BACKLOG.md)

## Stack

Vite + React + TypeScript frontend, Node backend, legacy
`footballsimulationengine` wrapper for `/match`, standalone TypeScript
`@the-ataturk/match-engine` for diagnostics/workbench simulations, SQLite for
state, Gemini 3 family for commentary, Gemini TTS / ElevenLabs for voice.
Deployment to Vercel is deferred.

## Licence

TBD. Likely MIT given dependency licences.
