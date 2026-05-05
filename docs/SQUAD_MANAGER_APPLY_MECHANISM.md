# Squad Manager Apply Mechanism

Date: 2026-05-05

## Scope

Squad Manager apply is deliberately narrow: only low-risk `player_update`
suggestions can be applied. Medium-risk position updates and high-risk
additions/removals remain review-only.

The previous public `POST /api/ai/apply-suggestions` route was removed after
inventory found only the admin UI, README, and tests as local callers. The safe
path is now the admin route below.

## Endpoint Contract

`POST /api/admin/squad-manager/apply`

Request body:

```json
{
  "clubId": "liverpool",
  "datasetVersionId": "fc25-20260504102445-4399cb2b-a504ee92",
  "riskLevel": "low",
  "suggestions": [],
  "verifyFresh": false
}
```

Rules:

- `clubId` must be a supported FC25 PL20 club id.
- `datasetVersionId` must exist and must currently be the active FC25 dataset.
- `riskLevel` must be `"low"`.
- `suggestions` must be non-empty and unique by `suggestionId`.
- `verifyFresh: true` is rejected for low-risk apply. Fresh verification is
  reserved for future medium/high-risk workflows and is never silently ignored.

Response body:

```json
{
  "newDatasetVersionId": "fc25-squad-manager-low-...",
  "activated": false,
  "idempotent": false,
  "summary": { "applied": 22, "updated": 22, "added": 0, "removed": 0 },
  "audit": {}
}
```

## Low-Risk Definition

Low-risk suggestions must be `player_update` suggestions whose changed fields
are limited to:

- `name`
- `nationality`
- `age`

The 2026-05-05 Liverpool validation batch contained `name` and `nationality`
changes only; zero low-risk suggestions contained `age`. `age` remains allowed
defensively because the triage classifier defines it as metadata-only.

Any `position` change, `player_addition`, or `player_removal` causes the whole
request to fail atomically.

## Dataset Versioning

Successful apply creates a new inactive FC25 dataset version:

- Source dataset rows are copied first.
- Low-risk changes are applied to the copied player rows.
- The source dataset version is never mutated.
- The new version is not activated automatically.

Activation is explicit:

`POST /api/admin/squad-manager/dataset-versions/:id/activate`

Rollback is the existing version-switch mechanism: activate an earlier FC25
dataset version from Squad Manager.

## Audit Trail

The new FC25 dataset version `description` stores JSON audit metadata:

- `kind: "squad-manager-apply"`
- `schemaVersion`
- `sourceDatasetVersionId`
- `clubId`
- `riskLevel`
- `suggestionIds`
- full `suggestions` payloads at apply time
- `payloadHash`
- `appliedAt`
- `actor` (`"squad-manager-ui"` for now)
- `verifyFresh`

Dataset options in the admin UI label applied versions with club, suggestion
count, and risk level.

## Idempotency And Concurrency

The server hashes the source dataset id, club id, risk level, and sorted
suggestion payloads. Re-applying the same payload against the same source
returns the existing applied version with `idempotent: true`.

A process-local lock rejects concurrent applies for the same club/source pair
with a conflict error.

## Validation

Live validation on 2026-05-05:

- Source: `fc25-20260504102445-4399cb2b-a504ee92`
- Club: `liverpool`
- Suggestions applied: 22 low-risk suggestions
- New version: `fc25-squad-manager-low-20260505114745-8c8ac582`
- After apply: source remained active, dataset-version count moved `3 -> 4`,
  new version was inactive
- Explicit activation: new version became active
- Sim spot-check: Liverpool vs Manchester City, seed `260505`, `full_90`,
  two repeated runs returned identical summaries (`1-0`, shots `11-8`)

Browser smoke on `/admin/squad-manager` confirmed review mode defaults on,
Sunderland suggestions can be verified and inspected, and low/medium/high apply
buttons remain guarded while review mode is on.

## Extension Points

Future work should add separate server-side applicators for:

- medium-risk position updates after formation-aware XI selection lands
- high-risk player additions after rating synthesis is designed
- high-risk player removals after replay-history compatibility is designed
- cross-club batch apply
- per-suggestion edit before apply
