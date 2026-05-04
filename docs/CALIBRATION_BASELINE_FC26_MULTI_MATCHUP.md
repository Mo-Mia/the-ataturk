# Calibration Baseline — FC26 Multi-Matchup

Last updated: 2026-05-04 11:27 SAST

## Purpose

Phase 12 measures FC26-active output across all five-club directional fixtures
and compares the result with real Premier League benchmarks. It answers the
Phase 11 question: was Liverpool vs Manchester City an unrepresentative
single-matchup undershoot, or is the real-squad FC26 event-volume gap broader?

No match-engine code changed. No calibration tuning happened. Phase 8 remains
historical until a future rebasing or tuning sprint acts on this recommendation.

Phase 13 has now diagnosed the Bucket 3 event-volume metrics from this baseline.
See `docs/PHASE_13_INVESTIGATION_FINDINGS.md`: the gap is not mostly a
definition mismatch; shot volume is governed primarily by carrier-action shoot
selection, fouls by low emitted challenge volume, and corners should be retested
after shot volume moves.

Raw report: `packages/match-engine/artifacts/calibration-multi-matchup-fc26.json`
(gitignored runtime artefact).

## Dataset And Command

- Active FC dataset version:
  `fc25-20260504073604-4399cb2b-7d80bef5`.
- Source file: `data/fc-25/FC26_20250921.csv`.
- Source SHA-256:
  `4399cb2bcc2a14a2872e76a118f8f4bf64d7954503949c75751a14f33863e3b2`.
- Git SHA at run: `eb9ba23`.
- Runtime: 158.8 seconds.

```bash
pnpm --filter @the-ataturk/data fc25:fc26-multi-matchup
```

The command exits with status `2` when Bucket 3 metrics exist. In this run that
exit code is expected: the report was written and the synthesis requires Mo/SA
review before rebasing or tuning.

## Sanity

The 50-seed sanity pass formed valid 4-3-3 XIs for all five clubs with no lineup
warnings.

| Club | Active XI players |
| --- | ---: |
| Arsenal | 11 |
| Aston Villa | 11 |
| Liverpool | 11 |
| Manchester City | 11 |
| Manchester United | 11 |

Liverpool vs Manchester City sanity means: shots `11.46`, goals `1.80`, fouls
`4.44`, cards `1.32`, corners `1.96`.

## Cross-Matchup Aggregate

Matrix: 20 directional fixtures, 100 seeds per fixture, 2000 full-90 matches.
All fixtures use 4-3-3, balanced mentality, normal tempo, medium pressing,
default line/width, and Auto Subs ON.

| Metric | FC26 mean | SE | 2025/26 real-PL mean | 2024/25 cross-check mean | Classification |
| --- | ---: | ---: | ---: | ---: | --- |
| Shots/match | 11.80 | 0.09 | 24.80 | 25.92 | Bucket 3 |
| Goals/match | 1.93 | 0.03 | 2.75 | 2.93 | Bucket 1 |
| Fouls/match | 4.49 | 0.05 | 21.59 | 22.07 | Bucket 3 |
| Cards/match | 1.17 | 0.02 | 3.85 | 4.19 | Bucket 2 |
| Corners/match | 2.00 | 0.03 | 9.93 | 10.30 | Bucket 3 |

Set-piece diagnostics:

| Metric | FC26 mean |
| --- | ---: |
| Direct FKs/match | 0.02 |
| Indirect FKs/match | 4.42 |
| Penalties/match | 0.03 |
| Set-piece goals/match | 0.11 |
| Penalty conversion | 79.69% |

Penalty conversion used 64 simulated attempts and 51 goals; Wilson 95% interval
is `[68.29%, 87.73%]`.

## Per-Fixture Means

| Fixture | Shots | Goals | Fouls | Cards | Corners | Home possession |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Arsenal v Aston Villa | 11.92 | 1.66 | 4.47 | 1.17 | 2.15 | 51.30% |
| Aston Villa v Arsenal | 11.26 | 1.91 | 4.56 | 1.23 | 1.91 | 48.67% |
| Arsenal v Liverpool | 11.85 | 1.97 | 4.75 | 1.14 | 1.82 | 49.61% |
| Liverpool v Arsenal | 11.97 | 2.05 | 4.51 | 1.21 | 1.67 | 50.71% |
| Arsenal v Manchester City | 12.19 | 2.01 | 4.47 | 1.06 | 1.94 | 50.28% |
| Manchester City v Arsenal | 11.62 | 1.98 | 4.52 | 1.10 | 2.14 | 49.82% |
| Arsenal v Manchester United | 11.83 | 1.72 | 4.69 | 1.23 | 2.05 | 51.87% |
| Manchester United v Arsenal | 11.61 | 1.88 | 4.51 | 1.15 | 1.99 | 48.11% |
| Aston Villa v Liverpool | 11.63 | 2.04 | 4.27 | 1.08 | 2.03 | 47.72% |
| Liverpool v Aston Villa | 12.56 | 1.93 | 4.28 | 1.08 | 2.10 | 51.83% |
| Aston Villa v Manchester City | 11.38 | 1.74 | 4.66 | 1.27 | 1.84 | 49.23% |
| Manchester City v Aston Villa | 11.93 | 1.96 | 4.32 | 1.13 | 1.86 | 51.29% |
| Aston Villa v Manchester United | 11.13 | 1.56 | 4.32 | 1.11 | 1.97 | 50.51% |
| Manchester United v Aston Villa | 11.26 | 1.64 | 4.76 | 1.24 | 2.33 | 50.08% |
| Liverpool v Manchester City | 12.24 | 2.06 | 4.52 | 1.35 | 2.07 | 50.70% |
| Manchester City v Liverpool | 11.96 | 2.13 | 4.48 | 1.17 | 2.04 | 49.61% |
| Liverpool v Manchester United | 11.92 | 2.08 | 4.53 | 1.17 | 1.88 | 52.36% |
| Manchester United v Liverpool | 12.54 | 2.38 | 4.10 | 1.23 | 2.01 | 48.07% |
| Manchester City v Manchester United | 10.87 | 1.66 | 4.61 | 1.19 | 1.88 | 51.62% |
| Manchester United v Manchester City | 12.27 | 2.16 | 4.47 | 1.05 | 2.33 | 48.71% |

## Variance Decomposition

Within-fixture variance dominates. Phase 11's Liverpool vs Manchester City
undershoot was not just a single-fixture defensive outlier; the low event volume
is stable across this five-club FC26 matrix.

| Metric | Within-fixture share | Between-fixture share |
| --- | ---: | ---: |
| Shots | 99.63% | 0.37% |
| Goals | 98.84% | 1.16% |
| Fouls | 100.00% | 0.00% |
| Cards | 100.00% | 0.00% |
| Corners | 99.67% | 0.33% |

## Home Advantage

| Metric | FC26 home-minus-away | SE | 2025/26 real-PL | 2024/25 cross-check |
| --- | ---: | ---: | ---: | ---: |
| Goals | -0.01 | 0.08 | +0.29 | +0.09 |
| Shots | +0.07 | 0.32 | +2.60 | +1.59 |
| Possession | +0.21pp | 0.62pp | n/a | n/a |

FC26 does not show a meaningful home-goal advantage in this matrix. Treat this
as a secondary finding: the primary Phase 12 concern is event volume.

## Classification

| Bucket | Count | Metrics |
| --- | ---: | --- |
| Bucket 1 | 1 | Goals |
| Bucket 2 | 1 | Cards |
| Bucket 3 | 3 | Shots, fouls, corners |

Interpretation:

- Goals are real-PL realistic even though shot volume is very low. That implies
  the engine is currently high conversion / low volume against real squads.
- Cards are low but inside two current-season SDs, so they are defensible as
  drift unless fouls are retuned.
- Shots, fouls, and corners are below both 2025/26-to-date and 2024/25 complete
  benchmarks. This is not a benchmark-season artefact.

## Recommendation

Do **not** execute a pure rebasing sprint yet. Phase 12 does not support simply
retiring Phase 8 synthetic bands and replacing them with real-PL bands without
discussion. The recommended next step is a Mo/SA decision on whether to:

1. Scope a tuning investigation for low event volume: shots, fouls, and corners.
2. Accept low-volume/high-conversion as a known FootSim style and rebase tests
   around it.
3. Split synthetic-engine and real-squad gates, keeping real-squad volume
   diagnostic until UAT says it matters.

If tuning is chosen, likely mechanisms to inspect are carrier action shot
frequency, foul/tackle attempt frequency, failed-pass/clearance restart
frequency, and corner-award probability. This is a future sprint; no tuning
happened in Phase 12.
