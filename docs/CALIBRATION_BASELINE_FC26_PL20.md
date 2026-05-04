# Calibration Baseline — FC26 PL20

Phase 13.5 broadens the FC26 runtime baseline from the original five-club
FootSim calibration set to all 20 English Premier League clubs in the FC26
export. This is the immediate input for Phase 14 event-volume tuning.

## Dataset

- Active dataset id: `fc25-20260504102445-4399cb2b-a504ee92`
- Name: `FC26 PL20 import 2026-05-04`
- Source: `data/fc-25/FC26_20250921.csv`
- Source filter: `league_id = 13`
- Clubs: 20
- Players / squad rows: 547
- Raw report: `packages/match-engine/artifacts/calibration-pl20-fc26.json`

The runtime SQLite DB is now intentionally active on this PL20 dataset. Phase 8
FC25/synthetic numbers and Phase 11/12 five-club FC26 numbers remain historical
references, not the active runtime baseline.

## Method

- 20 clubs, all ordered home/away pairings, no self-fixtures
- 380 directional fixtures
- 25 full-90 seeds per fixture
- 9,500 total runs
- Default tactics on both sides: 4-3-3, balanced mentality, normal tempo,
  medium pressing, normal line height, normal width
- Dynamics on: fatigue, score-state, Auto Subs, chance creation, set pieces,
  side switch

Sanity passed: every active club can field an 11-player 4-3-3 XI without lineup
warnings. Sunderland imports with 36 players and emits the intended
senior-squad-size warning; import proceeds.

## Squad Counts

| Club | Players |
|---|---:|
| AFC Bournemouth | 27 |
| Arsenal | 24 |
| Aston Villa | 24 |
| Brentford | 31 |
| Brighton | 26 |
| Burnley | 32 |
| Chelsea | 30 |
| Crystal Palace | 26 |
| Everton | 24 |
| Fulham | 24 |
| Leeds United | 26 |
| Liverpool | 28 |
| Manchester City | 26 |
| Manchester United | 26 |
| Newcastle United | 28 |
| Nottingham Forest | 28 |
| Sunderland | 36 |
| Tottenham Hotspur | 29 |
| West Ham United | 26 |
| Wolverhampton Wanderers | 26 |

## Aggregate Output

| Metric | PL20 mean | SE |
|---|---:|---:|
| Shots/match | 10.42 | 0.04 |
| Goals/match | 1.65 | 0.01 |
| Fouls/match | 4.09 | 0.02 |
| Cards/match | 1.00 | 0.01 |
| Corners/match | 2.00 | 0.01 |
| Direct free kicks/match | 0.02 | 0.00 |
| Indirect free kicks/match | 4.03 | 0.02 |
| Penalties/match | 0.03 | 0.00 |
| Set-piece goals/match | 0.11 | 0.00 |

Home effect was small in this matrix:

| Effect | Mean home-minus-away | SE |
|---|---:|---:|
| Goals | 0.04 | 0.03 |
| Shots | 0.14 | 0.11 |

## Interpretation

Complete PL20 ingestion does not explain away the Phase 12/13 event-volume gap.
The all-club baseline is slightly lower than the five-club Phase 12 aggregate:
shots `10.42` vs `11.80`, goals `1.65` vs `1.93`, fouls `4.09` vs `4.49`,
corners `2.00` vs `2.00`.

Phase 14 should therefore tune against the same priority order recommended by
Phase 13:

1. Baseline shot supply first.
2. Foul genesis second.
3. Retest corners after shot volume moves, then tune corner generation only if
   still low.
4. Keep direct card tuning out of scope until foul volume is corrected.

Primary guardrail: protect goals while increasing event volume. The engine is
low-volume/high-conversion today; raising shot supply without reducing
conversion will over-shoot goals.
