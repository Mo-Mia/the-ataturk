# Calibration Reference — Real Premier League Benchmarks

Last updated: 2026-05-04 10:30 SAST

## Purpose

This document records the real-PL benchmark sources used by Phase 12. The
primary anchor is 2025/26 to date because the FC26 export is a September 2025
dataset and the current football environment is closer to 2025/26 than to
2024/25. The 2024/25 complete season is kept as a stability cross-check.

The 2025/26 benchmark is provisional as of 2026-05-04. The Premier League
2025/26 season runs to 2026-05-24, so this is not a final-season baseline.

## Sources

| Source | Use | URL | Accessed |
| --- | --- | --- | --- |
| Premier League | Season-end date for 2025/26 provisional framing | `https://www.premierleague.com/en/news/4171848` | 2026-05-04 |
| Football-Data.co.uk | Primary fixture-level stats for goals, shots, fouls, cards, corners | `https://www.football-data.co.uk/mmz4281/2526/E0.csv` | 2026-05-04 |
| Football-Data.co.uk | Complete-season cross-check | `https://www.football-data.co.uk/mmz4281/2425/E0.csv` | 2026-05-04 |
| football-data.org | Access probe for existing project API token | `http://api.football-data.org/v4/competitions/PL/matches?season=2024&status=FINISHED&limit=1`, `http://api.football-data.org/v4/matches/497410` | 2026-05-04 |

football-data.org returned PL scores and fixture metadata under the existing
token, but did not expose `statistics`, lineups, bookings, or detailed match
events on either the competition match list or single-match resource. It is
therefore not used as the detailed benchmark source in Phase 12.

## Primary Benchmark: 2025/26 To Date

Source: Football-Data.co.uk `2526/E0.csv`, 347 completed matches at access time.

| Metric | Mean | SD | SE |
| --- | ---: | ---: | ---: |
| Shots/match | 24.80 | 5.37 | 0.29 |
| Goals/match | 2.75 | 1.59 | 0.09 |
| Fouls/match | 21.59 | 4.97 | 0.27 |
| Cards/match | 3.85 | 2.02 | 0.11 |
| Corners/match | 9.93 | 3.22 | 0.17 |

Home advantage:

| Metric | Mean home-minus-away | SD | SE |
| --- | ---: | ---: | ---: |
| Goals | +0.29 | 1.63 | 0.09 |
| Shots | +2.60 | 7.82 | 0.42 |

## Cross-Check: 2024/25 Complete

Source: Football-Data.co.uk `2425/E0.csv`, 380 completed matches.

| Metric | Mean | SD | SE |
| --- | ---: | ---: | ---: |
| Shots/match | 25.92 | 6.00 | 0.31 |
| Goals/match | 2.93 | 1.62 | 0.08 |
| Fouls/match | 22.07 | 5.27 | 0.27 |
| Cards/match | 4.19 | 2.25 | 0.12 |
| Corners/match | 10.30 | 3.47 | 0.18 |

Home advantage:

| Metric | Mean home-minus-away | SD | SE |
| --- | ---: | ---: | ---: |
| Goals | +0.09 | 1.87 | 0.10 |
| Shots | +1.59 | 9.22 | 0.47 |

## Benchmark Gaps

Football-Data.co.uk does not provide possession, direct/indirect free-kick
counts, penalty attempts, penalty conversion, or set-piece goals in the E0 CSV.
Because football-data.org did not expose detailed match statistics under the
current token, these remain Phase 12 diagnostic-only metrics rather than
classification gates.

For Phase 12 classification, only goals, shots, fouls, cards, and corners have
hard real-PL buckets.
