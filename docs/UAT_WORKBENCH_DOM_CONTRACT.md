# UAT Workbench DOM Contract

This document records stable navigation and dashboard selectors for browser UAT
agents. Prefer these ids and `data-uat` attributes over visual text or CSS
classes. CSS classes are presentational unless listed here.

## Routes

| Route | Purpose | Stable entry selector |
| --- | --- | --- |
| `/` | Dashboard | `[data-uat="dashboard-page"]` |
| `/visualise/run` | Sim Runner | `#nav-link-sim-runner` |
| `/visualise` | Snapshot Replay | `#nav-link-snapshot-replay` |
| `/visualise/compare` | Compare | `#nav-link-compare` |
| `/visualise/batch/:batchId` | Batch distribution | `#nav-link-latest-batch[data-batch-id]` |
| `/admin/squad-manager` | Admin Squad Manager | `#nav-link-squad-manager` |
| `/smoke-test` | Legacy smoke test | dashboard System Status link |

## Navigation

The persistent workbench navigation is exposed as:

- Shell: `[data-uat="workbench-shell"]`
- Nav: `[data-uat="workbench-navigation"]`
- Context line: `[data-uat="nav-context-line"]`
- Links: `#nav-link-dashboard`, `#nav-link-sim-runner`,
  `#nav-link-snapshot-replay`, `#nav-link-compare`,
  `#nav-link-squad-manager`, `#nav-link-latest-batch`

Use `aria-current="page"` to identify the active route. Use `data-state` to
distinguish enabled/disabled nav entries. Disabled nav entries expose
`aria-disabled="true"` and should not be clicked by UAT agents.

## Dashboard Widgets

| Widget | Selector | Entity attributes |
| --- | --- | --- |
| Active dataset | `[data-uat="dashboard-widget-active-dataset"]` | `data-dataset-version-id` |
| Recent runs | `[data-uat="dashboard-widget-recent-runs"]` | child `[data-uat="dashboard-recent-run"][data-run-id][data-artifact-id]` |
| Latest batch | `[data-uat="dashboard-widget-latest-batch"]` | `data-batch-id` |
| Engine character | `[data-uat="dashboard-widget-engine-character"]` | `data-baseline-doc` |
| System status | `[data-uat="dashboard-widget-system-status"]` | child `[data-uat="system-last-run"][data-run-id]` |

Every widget exposes `data-state` with one of `loading`, `ready`, `empty`, or
`error` where runtime data is involved. Agents should wait for `ready` or
`empty` before extracting values.

## Extractable Values

Use these value selectors when validating dashboard numbers:

- Active clubs: `[data-uat="active-dataset-club-count"][data-value]`
- Active players: `[data-uat="active-dataset-player-count"][data-value]`
- Latest batch run count: `[data-uat="latest-batch-run-count"][data-value]`
- Latest batch mean goals: `[data-uat="latest-batch-mean-goals"][data-value]`
- Latest batch mean shots: `[data-uat="latest-batch-mean-shots"][data-value]`
- Health status: `[data-uat="system-health-status"][data-value]`
- Engine metrics:
  `[data-uat="engine-character-metric"][data-metric][data-value][data-band-min][data-band-max][data-status]`

Dashboard charts or compact summaries must duplicate their key values as text
or data attributes. Agents should not infer numeric values from SVG/canvas
geometry.

## Recommended UAT Flow

1. Open `/` and wait for `[data-uat="dashboard-page"]`.
2. Confirm all dashboard widgets reach `data-state="ready"` or
   `data-state="empty"`.
3. Extract active dataset id, club count, player count, latest run id, latest
   batch id, health status, and engine metric values from the selectors above.
4. Navigate via the persistent nav ids rather than typing route patterns.
5. For entity click-through, use dashboard links with `data-run-id`,
   `data-artifact-id`, or `data-batch-id`, then assert the target page's own
   semantic labels.
