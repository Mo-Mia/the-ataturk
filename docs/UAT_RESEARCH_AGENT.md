# FootSim UAT Research Agent

`pnpm uat:research` runs an automated browser-driven UAT pass over the FootSim
workbench. It creates a disposable PL20 database, starts the server and web app
on local ephemeral ports, drives Playwright through representative workflows,
writes structured evidence JSON, then writes a deterministic Markdown report.
Gemini interpretation is optional; evidence JSON remains the source of truth.

## Command

```bash
pnpm uat:research
```

Useful flags:

- `--no-ai` skips Gemini and writes only evidence JSON plus the deterministic
  report.
- `--batch-size=N` controls the distribution scenario size. Default is `50`.
  Maximum is `100`.
- `--live-admin` lets Squad Manager verification call live external services.
  Without it, the admin scenario uses a fixture that still exercises
  verify -> triage -> low-risk apply -> activate through the UI.
- `--output-dir=PATH` changes the report directory. Default is
  `docs/UAT_REPORTS`.
- `--keep-temp` preserves the disposable database temp directory for debugging.
  These directories will not be removed at the end of the run; delete them
  manually when finished.

Expected runtime on Mo's local workstation:

- `--no-ai --batch-size=5`: roughly 10-30 seconds.
- Default `--no-ai --batch-size=50`: roughly 2-5 minutes.
- Default with Gemini enabled: roughly 3-7 minutes, depending on model latency.
- `--live-admin`: add roughly 30-120 seconds and consume live API quota.

## Safety Model

The runner is disposable by default. Each run imports PL20 data from
`data/fc-25/FC26_20250921.csv` into a temp SQLite database, then points the
local server at that database. The runtime database is not touched.

Startup pruning removes old UAT temp directories under the OS temp root after a
24-hour TTL. Anything newer is left alone so concurrent or recently crashed runs
are not disturbed. `--keep-temp` intentionally opts out of end-of-run cleanup for
that run, but the next startup can still prune it once it is older than 24 hours.

Match-run artefacts created during UAT are deleted before shutdown. Reports and
screenshots under `docs/UAT_REPORTS` are intentionally retained.

Report rotation policy is defined, but not implemented yet: keep the 20 most
recent reports or keep `docs/UAT_REPORTS/` under 25 MB, whichever threshold is
hit first. Rotation implementation is deferred until the threshold approaches.

## Scenarios

The v1 UAT pass covers:

- Dashboard active-dataset and health context.
- Sim Runner route load plus API-backed full-90 match creation.
- Replay page loading a generated snapshot artefact.
- Same-teams/same-seed tactical contrast: low pressing/slow tempo vs high
  pressing/fast tempo. Pass/fail is direction-only; magnitude is report context.
- Compare page loading two runs with different formations.
- Batch distribution page loading a generated batch.
- Squad Manager admin fixture: review-mode guard, verification, low-risk apply,
  audit metadata capture, and explicit activation of the new disposable dataset
  version.

The admin fixture includes low-risk `player_update` suggestions and
review-only medium/high suggestions. This validates that the currently
applicable path remains low-risk only.

Scenario definitions live in `scripts/uatResearchScenarios.ts`. Each scenario
declares its workflow steps, expected directions, evidence schema, and any
simulation payloads as data; `scripts/uatResearch.ts` remains the Playwright
executor. This keeps the current runner explicit while making scenarios
parameterisable for future generation work.

## Gemini Context

When AI interpretation is enabled, Gemini receives only:

- the structured evidence JSON,
- the scenario expectations embedded by the runner,
- calibration anchors embedded by the runner.

Gemini does not receive repository access, live database access, or hidden
state. Its Markdown output is interpretation; the evidence JSON is the
auditable record.

Use `--no-ai` for Gemini-independent operation or when API quota is not
available.
