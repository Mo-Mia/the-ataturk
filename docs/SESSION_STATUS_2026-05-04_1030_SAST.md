# Session Status — 2026-05-04 10:30 SAST

## Where The Project Stands

FootSim now has Phase 12 evidence for FC26-active real-squad calibration. The
engine remains unchanged and deterministic. The runtime DB is still active on
the FC26 import, and the Phase 8 FC25/synthetic baseline remains historical.

Phase 12 measured 20 directional fixtures across Arsenal, Aston Villa,
Liverpool, Manchester City, and Manchester United: 2000 full-90 simulated
matches. Goals are realistic against real-PL benchmarks, cards are defensible,
but shots, fouls, and corners are materially below both 2025/26-to-date and
2024/25 complete Premier League data.

## Repo State

- Branch: `main`
- Latest commit before docs commit: `eb9ba23 test(data): cover phase 12 benchmark helpers`
- Runtime DB: active FC26 dataset
  `fc25-20260504073604-4399cb2b-7d80bef5`
- Raw Phase 12 report:
  `packages/match-engine/artifacts/calibration-multi-matchup-fc26.json`
  (gitignored)

## What Landed

- `320de85 feat(data): add fc26 multi-matchup characterisation harness`
  - Added `pnpm --filter @the-ataturk/data fc25:fc26-multi-matchup`.
  - Added 20-directional-fixture FC26 harness, Football-Data.co.uk benchmark
    parsing, variance decomposition, home-advantage reporting, and buckets.
- `eb9ba23 test(data): cover phase 12 benchmark helpers`
  - Added tests for matrix generation, benchmark parsing, classification, FC26
    preflight rejection, and tiny offline report generation.

## Measurement Result

Command:

```bash
pnpm --filter @the-ataturk/data fc25:fc26-multi-matchup
```

Result: completed in 158.8 seconds. Exit status `2` is expected because Bucket 3
metrics exist.

| Metric | FC26 | 2025/26 real PL | 2024/25 real PL | Bucket |
| --- | ---: | ---: | ---: | --- |
| Shots | 11.80 | 24.80 | 25.92 | 3 |
| Goals | 1.93 | 2.75 | 2.93 | 1 |
| Fouls | 4.49 | 21.59 | 22.07 | 3 |
| Cards | 1.17 | 3.85 | 4.19 | 2 |
| Corners | 2.00 | 9.93 | 10.30 | 3 |

## Decision Queue

Phase 12 recommends **not** executing pure rebasing yet. The next Mo/SA decision
is whether low event volume should be tuned or accepted as FootSim's current
real-squad style.

Concrete options for next session:

- Scope a tuning investigation for low shots/fouls/corners.
- Accept low-volume/high-conversion as a documented style and rebase tests.
- Keep synthetic and real-squad gates separate, with real-squad volume
  diagnostic until UAT says otherwise.

## Operating Notes

- 2025/26-to-date is primary because it matches the FC26 export era. 2024/25 is
  a complete-season cross-check.
- football-data.org was probed with the existing token. It returned PL scores
  but not detailed match statistics, so it is not sufficient for Phase 12
  benchmarks.
- Football-Data.co.uk supplied goals, shots, fouls, cards, and corners.
- Possession, direct/indirect free kicks, penalties, and set-piece goals remain
  diagnostic-only because the public benchmark source does not cover them
  cleanly.
