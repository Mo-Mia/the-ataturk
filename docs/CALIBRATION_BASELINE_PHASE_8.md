# Calibration Baseline — Phase 8

Last updated: 2026-05-03 17:43 SAST

## Purpose

This document locks the current FootSim calibration baseline after Phase 9's
manual-XI investigation. It is the source of truth for Phase 8 consolidation
work: documentation and tests may assert against these numbers, but this sprint
does not tune engine behaviour.

Two precision tiers are used:

- `200_seed_unpaired`: normal characterisation and responsiveness checks.
- `1000_seed_paired`: high-variance personnel-impact checks. Phase 9 proved
  manual XI rotation needs this tier.

## Commands

```bash
pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration second_half --seeds 200
pnpm --filter @the-ataturk/match-engine characterise -- --schema v2 --preferred-foot-mode rated --duration full_90 --seeds 200
pnpm --filter @the-ataturk/data fc25:responsiveness -- --csv data/fc-25/fixtures/male_players_top5pl.csv --seeds 200 --output packages/match-engine/artifacts/real-squad-responsiveness-phase8.json
```

Manual XI rotation uses the Phase 9 1000-seed paired result rather than rerunning
inside this baseline:

```bash
pnpm --filter @the-ataturk/data fc25:manual-xi-investigation -- --csv data/fc-25/fixtures/male_players_top5pl.csv --mode all --output packages/match-engine/artifacts/manual-xi-impact-phase9.json
```

## Human Summary

### Characterisation

| Duration | Seeds | Shots | Goals | Fouls | Cards | Calibration |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Second half | 200 | 10.45 | 1.63 | 5.18 | 1.43 | PASS |
| Full 90 | 200 | 18.06 | 2.73 | 9.62 | 2.77 | PASS |

### Set Pieces

| Duration | Corners | Direct FKs | Indirect FKs | Penalties | Set-piece goals | Penalty conversion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Second half | 1.31 | 0.06 | 5.04 | 0.08 | 0.13 | 81.3% |
| Full 90 | 2.45 | 0.06 | 9.38 | 0.14 | 0.21 | 72.4% |

### Real-Squad Responsiveness

| Experiment | Seeds | Tier | Baseline | Variant | Delta | Threshold | Status |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Mentality | 200 | 200_seed_unpaired | 3.82 | 8.825 | +131.02% | 30% | PASS |
| Pressing | 200 | 200_seed_unpaired | 1.22 | 4.36 | +257.38% | 20% | PASS |
| Tempo | 200 | 200_seed_unpaired | 3.547 | 2.891 | -18.51% | 15% | PASS |
| Manual XI rotation | 200 | 200_seed_unpaired | 0.865 | 0.795 | -8.09% | 7% | PASS |
| Manual XI rotation | 1000 | 1000_seed_paired | 0.923 | 0.776 | -15.93% | diagnostic | PASS |
| Fatigue impact | 200 | 200_seed_unpaired | 54.87 | 52.93 | -3.54% | 3% | PASS |
| Score-state urgency | 200 | 200_seed_unpaired | 1.05 | 1.23 | +16.62% | 5% | PASS |
| Auto Subs activation | 200 | 200_seed_unpaired | n/a | 4.87 subs/match | n/a | activation | PASS |
| Score-state shot impact | 200 | 200_seed_unpaired | 0.975 | 1.265 | +29.74% | 15% | PASS |

The isolated chance-creation toggle produced `-7.14%` final-15 home shots at
200 seeds (`1.05 -> 0.975`) and is recorded as an anomaly. The headline
score-state shot-impact experiment, which is the intended composition target
for chance creation, passes at `+29.74%`.

## Machine-Readable Baseline Schema

The verifier reads the JSON block between
`phase8-baseline-json:start` and `phase8-baseline-json:end`. Future edits must
preserve this schema:

- `schemaVersion`: integer. Current value: `1`.
- `generatedAt`: ISO-like timestamp string for the baseline lock.
- `precisionTiers`: object keyed by tier name. Each tier has:
  - `seeds`: integer.
  - `analysis`: short string naming paired/unpaired method.
  - `useFor`: array of strings explaining intended use.
- `characterisation`: array of duration rows. Each row has:
  - `id`, `duration`, `schema`, `preferredFootMode`: strings.
  - `seeds`: integer.
  - `metrics`: object with numeric `shots`, `goals`, `fouls`, `cards`.
  - `targets`: object with `[min, max]` numeric arrays for shots/goals/fouls/cards.
  - `setPieces`: object with numeric counts.
  - `scoreDistribution`: array of `{ score, count, sharePct }`.
  - `pass`: boolean.
- `responsiveness`: object with:
  - `csvPath`: string.
  - `experiments`: array of experiment rows.
  - `manualXiPhase9`: the 1000-seed paired Phase 9 result.
- Experiment rows have:
  - `name`, `metric`, `tier`, `baselineLabel`, `variantLabel`: strings.
  - `seeds`, `thresholdPct`: numbers; `thresholdPct` may be `null` for diagnostic rows.
  - `baselineAverage`, `variantAverage`, `deltaPct`: numbers; may be `null` only when a metric is activation-based.
  - `status`: `PASS`, `FAIL`, or `DIAGNOSTIC`.
- `anomalies`: array of strings.

<!-- phase8-baseline-json:start -->
```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-03T17:43:00+02:00",
  "precisionTiers": {
    "200_seed_unpaired": {
      "seeds": 200,
      "analysis": "unpaired mean comparison over identical seed sets",
      "useFor": ["characterisation", "tactical responsiveness", "low-to-medium variance mechanics"]
    },
    "1000_seed_paired": {
      "seeds": 1000,
      "analysis": "paired-seed goal-delta analysis",
      "useFor": ["manual XI rotation", "personnel-impact experiments", "high-variance low-goal metrics"]
    }
  },
  "characterisation": [
    {
      "id": "second_half_v2_rated_200",
      "duration": "second_half",
      "schema": "v2",
      "preferredFootMode": "rated",
      "seeds": 200,
      "metrics": { "shots": 10.45, "goals": 1.63, "fouls": 5.18, "cards": 1.43 },
      "targets": { "shots": [8, 12], "goals": [1, 3], "fouls": [4, 8], "cards": [1, 3] },
      "setPieces": {
        "corners": 1.31,
        "directFreeKicks": 0.06,
        "indirectFreeKicks": 5.04,
        "penalties": 0.08,
        "setPieceGoals": 0.13,
        "cornerGoals": 0.06,
        "directFreeKickGoals": 0.01,
        "penaltyGoals": 0.07,
        "penaltyConversionPct": 81.3
      },
      "scoreDistribution": [
        { "score": "0-3", "count": 39, "sharePct": 20 },
        { "score": "1-3", "count": 34, "sharePct": 17 },
        { "score": "1-4", "count": 29, "sharePct": 14 },
        { "score": "0-4", "count": 27, "sharePct": 14 },
        { "score": "2-3", "count": 15, "sharePct": 8 }
      ],
      "pass": true
    },
    {
      "id": "full_90_v2_rated_200",
      "duration": "full_90",
      "schema": "v2",
      "preferredFootMode": "rated",
      "seeds": 200,
      "metrics": { "shots": 18.06, "goals": 2.73, "fouls": 9.62, "cards": 2.77 },
      "targets": { "shots": [16, 24], "goals": [2, 6], "fouls": [8, 16], "cards": [2, 6] },
      "setPieces": {
        "corners": 2.45,
        "directFreeKicks": 0.06,
        "indirectFreeKicks": 9.38,
        "penalties": 0.14,
        "setPieceGoals": 0.21,
        "cornerGoals": 0.11,
        "directFreeKickGoals": 0,
        "penaltyGoals": 0.1,
        "penaltyConversionPct": 72.4
      },
      "scoreDistribution": [
        { "score": "2-1", "count": 21, "sharePct": 11 },
        { "score": "1-0", "count": 20, "sharePct": 10 },
        { "score": "1-1", "count": 20, "sharePct": 10 },
        { "score": "0-0", "count": 20, "sharePct": 10 },
        { "score": "2-0", "count": 20, "sharePct": 10 }
      ],
      "pass": true
    }
  ],
  "responsiveness": {
    "csvPath": "data/fc-25/fixtures/male_players_top5pl.csv",
    "experiments": [
      {
        "name": "Mentality",
        "metric": "homeShots",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Liverpool defensive",
        "variantLabel": "Liverpool attacking",
        "baselineAverage": 3.82,
        "variantAverage": 8.825,
        "deltaPct": 131.02094240837692,
        "thresholdPct": 30,
        "status": "PASS"
      },
      {
        "name": "Pressing",
        "metric": "homeFouls",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Liverpool low pressing",
        "variantLabel": "Liverpool high pressing",
        "baselineAverage": 1.22,
        "variantAverage": 4.36,
        "deltaPct": 257.3770491803279,
        "thresholdPct": 20,
        "status": "PASS"
      },
      {
        "name": "Tempo",
        "metric": "homePossessionStreak",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Liverpool slow tempo",
        "variantLabel": "Liverpool fast tempo",
        "baselineAverage": 3.547070694071823,
        "variantAverage": 2.890681568255643,
        "deltaPct": -18.505104138837588,
        "thresholdPct": 15,
        "status": "PASS"
      },
      {
        "name": "Manual XI rotation",
        "metric": "homeGoals",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Liverpool auto XI",
        "variantLabel": "Liverpool rotated XI",
        "baselineAverage": 0.865,
        "variantAverage": 0.795,
        "deltaPct": -8.092485549132942,
        "thresholdPct": 7,
        "status": "PASS"
      },
      {
        "name": "Fatigue impact",
        "metric": "lateActionSuccessRate",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Fatigue disabled",
        "variantLabel": "Fatigue enabled",
        "baselineAverage": 54.870113483523,
        "variantAverage": 52.92899857176847,
        "deltaPct": -3.5376542684524086,
        "thresholdPct": 3,
        "status": "PASS"
      },
      {
        "name": "Score-state urgency",
        "metric": "final15AverageUrgency",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Tied control urgency",
        "variantLabel": "Liverpool trailing 0-2 urgency",
        "baselineAverage": 1.0534575415282406,
        "variantAverage": 1.228550498338871,
        "deltaPct": 16.62078915459895,
        "thresholdPct": 5,
        "status": "PASS"
      },
      {
        "name": "Auto Subs activation",
        "metric": "substitutions",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Auto Subs OFF",
        "variantLabel": "Auto Subs ON",
        "baselineAverage": null,
        "variantAverage": 4.87,
        "deltaPct": null,
        "thresholdPct": null,
        "status": "PASS"
      },
      {
        "name": "Score-state shot impact",
        "metric": "homeFinal15Shots",
        "tier": "200_seed_unpaired",
        "seeds": 200,
        "baselineLabel": "Tied control",
        "variantLabel": "Liverpool trailing 0-2 at 75'",
        "baselineAverage": 0.975,
        "variantAverage": 1.265,
        "deltaPct": 29.743589743589737,
        "thresholdPct": 15,
        "status": "PASS"
      }
    ],
    "manualXiPhase9": {
      "name": "Manual XI rotation",
      "metric": "homeGoals",
      "tier": "1000_seed_paired",
      "seeds": 1000,
      "baselineLabel": "Liverpool auto XI",
      "variantLabel": "Liverpool rotated XI",
      "baselineAverage": 0.923,
      "variantAverage": 0.776,
      "pairedGoalDeltaAverage": -0.147,
      "pairedGoalDeltaStandardError": 0.03976143825331228,
      "deltaPct": -15.92632719393283,
      "deltaStandardErrorPct": 4.307848131453118,
      "confidenceInterval95Pct": [-24.369709531580938, -7.482944856284719],
      "thresholdPct": null,
      "status": "PASS",
      "source": "docs/PHASE_9_INVESTIGATION_FINDINGS.md"
    }
  },
  "anomalies": [
    "Chance creation isolated-toggle diagnostic produced -7.14% final-15 home shots at 200 seeds, while the intended score-state shot-impact composition passed at +29.74%. Documented for future investigation; no tuning in Phase 8."
  ]
}
```
<!-- phase8-baseline-json:end -->
