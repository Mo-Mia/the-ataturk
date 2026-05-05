# UAT Workbench DOM Contract

This document records stable navigation and dashboard selectors for browser UAT
agents. Prefer these ids and `data-uat` attributes over visual text or CSS
classes. CSS classes are presentational unless listed here.

## Routes

| Route | Purpose | Stable entry selector |
| --- | --- | --- |
| `/` | Dashboard | `[data-uat="dashboard-page"]` |
| `/visualise/run` | Sim Runner | `[data-uat="sim-runner-page"]` |
| `/visualise` | Snapshot Replay | `[data-uat="snapshot-replay-page"]` |
| `/visualise/compare` | Compare | `[data-uat="compare-page"]` |
| `/visualise/batch/:batchId` | Batch distribution | `[data-uat="batch-page"][data-batch-id]` |
| `/admin/squad-manager` | Admin Squad Manager | `[data-uat="squad-manager-page"]` |
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

## Sim Runner

Stable page and entity selectors:

| Entity | Selector | Entity attributes |
| --- | --- | --- |
| Page | `[data-uat="sim-runner-page"]` | `data-state` |
| Setup grid | `[data-uat="sim-runner-setup"]` | none |
| Run controls | `[data-uat="sim-runner-controls"]` | none |
| Team panel | `[data-uat="sim-runner-team-panel"]` | `data-team-side`, `data-club-id` |
| Squad picker | `[data-uat="sim-runner-squad-picker"]` | child player rows |
| Squad player | `[data-uat="sim-runner-squad-player"]` | `data-player-id`, `data-display-name`, `data-source-name` |
| Scheduled substitutions | `[data-uat="sim-runner-scheduled-subs"]` | player names rendered as text |
| Run history | `[data-uat="sim-runner-history"]` | child run rows |
| Run row | `[data-uat="sim-runner-run-row"]` | `data-run-id`, `data-artifact-id`, `data-batch-id` |

Player labels prefer `displayName`, then `shortName`, then `name`. Full FC
source names remain extractable through `data-source-name` where player rows
are rendered.

## Snapshot Replay

Stable page and control selectors:

| Entity | Selector | Entity attributes |
| --- | --- | --- |
| Page | `[data-uat="snapshot-replay-page"]` | `data-state`, `data-artifact-id` |
| Artifact select | `[data-uat="snapshot-artifact-select"]` | selected artifact filename |
| Play toggle | `[data-uat="snapshot-play-toggle"]` | button text |
| Timeline | `[data-uat="snapshot-timeline"]` | range `value`, `min`, `max` |
| Replay view | `[data-uat="snapshot-view-replay"]` | none |
| Heatmap view | `[data-uat="snapshot-view-heatmap"]` | none |
| Heatmap subject | `[data-uat="snapshot-heatmap-subject"]` | selected subject |
| Heatmap filter | `[data-uat="snapshot-heatmap-filter"]` | selected filter |
| Heatmap player | `[data-uat="snapshot-heatmap-player"]` | selected player id |
| Workbench | `[data-uat="snapshot-workbench"]` | contains pitch/inspector content |

Replay player option labels use snapshot roster `displayName` when present.
Older artefacts may only expose `shortName`; agents should accept either.

## Compare

Stable page and entity selectors:

| Entity | Selector | Entity attributes |
| --- | --- | --- |
| Page | `[data-uat="compare-page"]` | `data-state` |
| Picker | `[data-uat="compare-picker"]` | child run selects |
| Run select | `[data-uat="compare-run-select"]` | selected run id |
| Summary | `[data-uat="compare-summary"]` | key diff values as text |
| Lineups | `[data-uat="compare-lineups"]` | line-up text uses display names |
| Lineup block | `[data-uat="compare-lineup-block"]` | player ids are in persisted run JSON |
| Substitutions | `[data-uat="compare-substitutions"]` | substitution counts as text |
| Run column | `[data-uat="compare-run-column"]` | `data-run-id` |

## Batch Distribution

Stable page and entity selectors:

| Entity | Selector | Entity attributes |
| --- | --- | --- |
| Page | `[data-uat="batch-page"]` | `data-state`, `data-batch-id` |
| Metadata | `[data-uat="batch-metadata"]` | matchup/tactics/duration as text |
| Batch XI | `[data-uat="batch-lineup"]` | player labels as text |
| Summary table | `[data-uat="batch-summary"]` | child summary rows |
| Summary row | `[data-uat="batch-summary-row"]` | `data-metric` |
| Histograms | `[data-uat="batch-histograms"]` | child histograms |
| Histogram | `[data-uat="batch-histogram"]` | `data-metric` |

Histogram key values are duplicated in the summary table. Agents should use the
table for extraction and treat charts as navigation affordances only.

## Squad Manager

Stable page and entity selectors:

| Entity | Selector | Entity attributes |
| --- | --- | --- |
| Page | `[data-uat="squad-manager-page"]` | `data-state` |
| Dataset select | `[data-uat="squad-manager-dataset-select"]` | selected dataset version id |
| Home club select | `[data-uat="squad-manager-home-club-select"]` | selected club id |
| Away club select | `[data-uat="squad-manager-away-club-select"]` | selected club id |
| Focused club select | `[data-uat="squad-manager-focused-club-select"]` | selected club id |
| Football-data status | `[data-uat="squad-manager-football-data-status"]` | `data-club-id`, `data-football-data-state`, `data-football-data-team-id`, `data-football-data-name` |
| Board | `[data-uat="squad-manager-board"]` | contains squad lists and verification panel |
| Squad list | `[data-uat="squad-manager-squad-list"]` | child player rows |
| Squad player | `[data-uat="squad-manager-player"]` | `data-player-id`, `data-display-name`, `data-source-name`, `data-source-short-name` |

Squad Manager shows friendly display names while preserving full source names
as tooltips and data attributes for audit. Every active FC26 PL20 club now
exposes a mapped football-data.org team id/name through the status row.

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
