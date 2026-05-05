# UAT Quality Assessment — 2026-05-05

## Scope

This assessment ran the FootSim UAT research agent ten times across deterministic,
Gemini-authored, small-batch, default-batch, and live-admin modes.

Purpose: decide whether the current UAT foundation is stable enough to continue
toward scenario generalisation and, later, a self-improving UAT experiment.

## Runs

| Run | AI | Live admin | Batch | State | Direction assertion | Batch mean goals | Batch mean shots | Admin applied |
| --- | --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| `UAT_RESEARCH_20260505-171303-SAST` | no | no | 5 | pass | `10 -> 22`, pass | 2.00 | 24.40 | 2 |
| `UAT_RESEARCH_20260505-171321-SAST` | no | no | 5 | pass | `10 -> 22`, pass | 2.00 | 24.40 | 2 |
| `UAT_RESEARCH_20260505-171531-SAST` | yes | no | 5 | pass | `10 -> 22`, pass | 2.00 | 24.40 | 2 |
| `UAT_RESEARCH_20260505-172600-SAST` | no | no | 50 | pass | `10 -> 22`, pass | 2.74 | 24.90 | 2 |
| `UAT_RESEARCH_20260505-172635-SAST` | yes | no | 5 | pass | `10 -> 22`, pass | 2.00 | 24.40 | 2 |
| `UAT_RESEARCH_20260505-172849-SAST` | yes | no | 50 | pass | `10 -> 22`, pass | 2.74 | 24.90 | 2 |
| `UAT_RESEARCH_20260505-173016-SAST` | no | no | 50 | pass | `10 -> 22`, pass | 2.74 | 24.90 | 2 |
| `UAT_RESEARCH_20260505-173110-SAST` | yes | no | 50 | pass | `10 -> 22`, pass | 2.74 | 24.90 | 2 |
| `UAT_RESEARCH_20260505-173208-SAST` | no | yes | 5 | pass | `10 -> 22`, pass | 2.00 | 24.40 | 43 |
| `UAT_RESEARCH_20260505-174009-SAST` | no | no | 5 | pass | `10 -> 22`, pass | 2.00 | 24.40 | 2 |

All ten runs reported six scenario passes, zero failures, zero warnings, and zero
browser console issues.

## Evidence Consistency

Stable values across all ten runs:

- Dashboard: active dataset `uat-fc26-pl20`, 20 clubs, 547 players.
- Replay scenario: score `2-1`, shots `19-16`, fouls `8-12`.
- Tactical contrast: low pressing/slow tempo fouls `10`; high pressing/fast tempo fouls `22`; direction-only assertion passed every time.
- Formation compare: home XI changed every time.
- Admin apply: audit actor `squad-manager-ui`; audit risk `low`; explicit activation succeeded.

Expected variable values:

- Run ids, batch ids, artefact names, temp paths, timestamps, and new dataset
  version ids varied by run.
- Batch means varied only by configured batch size: batch-size 5 produced
  goals `2.00`, shots `24.40`; batch-size 50 produced goals `2.74`, shots
  `24.90`.
- Live-admin run applied 43 low-risk live suggestions instead of the two
  fixture suggestions. That is expected because `--live-admin` bypasses the
  fixture route.

## Gemini Consistency

Four Gemini-authored reports were generated:

- `UAT_RESEARCH_20260505-171531-SAST_GEMINI.md`
- `UAT_RESEARCH_20260505-172635-SAST_GEMINI.md`
- `UAT_RESEARCH_20260505-172849-SAST_GEMINI.md`
- `UAT_RESEARCH_20260505-173110-SAST_GEMINI.md`

Gemini's structure drifted modestly: headings and wording changed between
reports, and report length ranged from 227 to 299 words. The underlying
classification did not drift. Every report identified the run as PASS, named
the same six successful scenario areas, correctly repeated the `10 -> 22` foul
direction assertion, and described Squad Manager as guarded review mode plus
apply-then-activate.

No Gemini report invented a failing scenario, missed an actual failing
assertion, or contradicted the evidence JSON. One report used broad language
such as "without issue"; the evidence supports that in this sample because
console issues were empty and all scenario states passed.

## Findings

The evidence JSON is highly stable for deterministic and seeded workflows.
This is the strongest foundation property for future automation: the same
scenario under the same configuration produces identical pass/fail
classifications and identical metric values, aside from expected ids and
timestamps.

Gemini is useful as an interpretation layer but should not become the source of
truth. It is consistent enough for human-readable summaries, but its prose
format is not stable enough for machine gating.

The live-admin run exposed one report-quality issue: the admin scenario
observation says "Applied 43 low-risk fixture suggestions" even when
`--live-admin` is enabled. The applied count and audit fields are correct, but
the word "fixture" is wrong for live-admin mode.

The follow-up scenario-generalisation change fixes this wording for future runs
by deriving "fixture" vs "live" from UAT options. The historical live-admin
report remains useful evidence of the issue.

## Recommendation

Proceed to scenario generalisation. The UAT foundation is strong enough for the
next step: declarative scenario definitions with explicit workflow steps,
expected directions, and evidence schemas.

Do not proceed directly to a multi-cycle self-improving autonomous loop yet.
Before that experiment, fix the live-admin wording issue, make Gemini output
schema-constrained if it will be machine-compared, and define hard constraints
for what an autonomous loop may change.

Near-term direction: scenario generalisation is justified. The self-improving
loop remains R&D, not core product.
