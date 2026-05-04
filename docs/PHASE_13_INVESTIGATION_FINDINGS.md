# Phase 13 Investigation Findings — Event Volume Gap Diagnostic

Last updated: 2026-05-04 12:37 SAST

## Purpose

Phase 13 diagnoses the FC26-vs-real-PL event-volume gap surfaced by Phase 12.
It does not tune constants and does not change engine behaviour. The output is
Phase 14 input: where the gap lives, which mechanisms should move first, and
what risks the tuning sprint should control.

Raw diagnostic report:
`packages/match-engine/artifacts/phase13-event-volume-diagnostics.json`
(gitignored runtime artefact).

Phase 13.5 imported the complete English Premier League FC26 club universe and
confirmed the same event-volume problem at PL20 scale. Use
`docs/CALIBRATION_BASELINE_FC26_PL20.md` as the immediate Phase 14 measurement
anchor, and use this document for mechanism priority and risk framing.

Command:

```bash
pnpm --filter @the-ataturk/data fc25:phase13-event-volume
```

Dataset: `fc25-20260504073604-4399cb2b-7d80bef5`, imported from
`data/fc-25/FC26_20250921.csv`. Git SHA at diagnostic run: `a9a8900`.

## Method

The harness ran five representative FC26 directional fixtures, 100 full-90
seeds each:

| Fixture | Reason |
| --- | --- |
| Liverpool vs Manchester City | Phase 11/12 anchor and top-defensive matchup |
| Manchester United vs Liverpool | High-goal Phase 12 profile |
| Manchester City vs Manchester United | Low-shot Phase 12 profile |
| Arsenal vs Aston Villa | Mid-matrix profile outside the Liverpool/City axis |
| Aston Villa vs Manchester City | Low-goal Phase 12 profile with City away |

The harness is snapshot-only. It counts emitted events and final-summary stats.
It deliberately does not pretend to count pre-roll internals that the engine
does not emit: raw missed tackle attempts, corner-eligible clearances that did
not become corners, failed deflection-corner rolls, and carrier actions that
resolve as hold or ordinary short circulation.

## Definition Audit

Football-Data.co.uk's official notes define `HS/AS` as shots, `HF/AF` as fouls
committed, `HC/AC` as corners, and card columns as issued cards. Source:
<https://www.football-data.co.uk/notes.txt>.

| Metric | Definition match | Finding |
| --- | --- | --- |
| Shots | Equivalent | FootSim increments total shots before on-target/off-target/block resolution, so it already includes the main categories implied by Football-Data.co.uk shots. No material correction. |
| Goals | Equivalent | Full-time goals are directly comparable. |
| Fouls | Equivalent | Both count awarded/committed fouls, not all challenge attempts. No material correction. |
| Cards | Minor caveat | Football-Data.co.uk English yellow-card notes exclude the initial yellow when a second yellow becomes red. That would lower the real card count slightly, so it does not explain FootSim's lower cards. |
| Corners | Equivalent | Both count awarded corners. FootSim has fewer corner-generation pathways than real football, but the counted event is equivalent. |

Conclusion: the Phase 12 event-volume gap is real, not mostly a metric-definition
artefact.

## Diagnostic Results

Aggregate over 500 full-90 matches:

| Metric | Mean | SE |
| --- | ---: | ---: |
| Shots | 11.79 | 0.17 |
| Goals | 1.90 | 0.07 |
| Fouls | 4.47 | 0.11 |
| Cards | 1.24 | 0.05 |
| Corners | 1.99 | 0.07 |
| Chances created | 4.69 | 0.13 |
| Chance-created shots | 0.17 | 0.02 |
| Open-play carrier shots | 11.23 | 0.17 |
| Set-piece shots | 0.39 | 0.03 |
| Successful tackles emitted | 7.15 | 0.14 |
| Observable tackle resolutions | 11.62 | 0.19 |
| Throw-ins | 36.77 | 0.31 |
| Goal kicks | 8.31 | 0.15 |

Shot supply:

| Source | Shots/match | Share |
| --- | ---: | ---: |
| Open-play carrier action | 11.23 | 95.3% |
| Set pieces | 0.39 | 3.3% |
| Chance creation | 0.17 | 1.5% |

Chance creation emits `4.69` chances/match, but only `3.6%` become shots. This
means ordinary match shot volume is currently governed almost entirely by the
baseline carrier-action shoot decision, not by Phase 6 chance creation.

Foul supply:

| Metric | Mean |
| --- | ---: |
| Fouls | 4.47 |
| Free kicks awarded | 4.44 |
| Penalties awarded | 0.03 |
| Successful tackles emitted | 7.15 |
| Fouls as share of observable tackle resolutions | 38.7% |
| Cards per foul | 27.8% |

The harness cannot count raw tackle attempts without engine-source
instrumentation. It can say the emitted challenge economy is small: only
`11.62` observable foul-or-successful-tackle resolutions/match. Phase 14 should
treat tackle-attempt frequency and foul-given-tackle probability as the first
foul levers.

Corner supply:

| Metric | Mean |
| --- | ---: |
| Corners | 1.99 |
| Corners from deflected shots | 0.48 |
| Corners from defensive clearances | 1.51 |
| Corner-taken events | 1.97 |
| Corner shots | 0.34 |
| Corners per shot | 16.9% |

Corners are low in absolute terms, but not obviously low per current shot
volume. The initial read is that corners inherit much of the low shot-volume
problem. Retest corners after shot volume moves before tuning corner-award
probabilities in isolation.

## Mechanism Candidates

| Priority | Candidate | Current values | Expected effect | Main risks |
| ---: | --- | --- | --- | --- |
| 1 | `carrierAction.ts` shot selection: `ACTION_WEIGHTS.att.*.shoot`, `shotDistance.*.actionWeight` | Attacking-zone shoot weights: low `0.18`, medium `0.26`, high `0.38`; speculative action weight `0.12` | Directly lifts shot volume | Goals are already realistic; mentality, tempo and score-state multiply this path |
| 2 | `pressure.ts` / `tackle.ts`: `tackleAttemptByPressure`, `foulOnTackleByPressure` | Attempts low/medium/high `0.01/0.02/0.034`; foul-on-tackle `0.13/0.16/0.21` | Lifts fouls; attempt tuning also lifts turnovers | Pressing responsiveness may amplify; more turnovers can suppress attacks |
| 3 | `chanceCreation.ts`: `CHANCE_CREATION.sourceBase`, pressure and distance gates | Source bases `0.055-0.12`; medium pressure `0.58`; high pressure `0`; far/speculative `0` | Adds richer shot texture and late-chase supply | Broad boosts can overheat elite attacks and score-state composition |
| 4 | `shot.ts` / `clearance.ts`: deflection and clearance corner probabilities | Deflected-shot corners `0.025/0.045/0.07`; clearance out `0.14`; defensive-clearance corner `0.46` | Lifts corners if still low after shot tuning | Corner shots and set-piece goals rise; tuning alone may detach corners from pressure |
| 5 | `tackle.ts`: `yellowOnFoul`, `redOnFoul` | Yellow `0.25`; red `0.012` | Downstream card correction only | Direct card tuning can mask the foul-volume issue |

## Phase 14 Recommendation

Recommended order:

1. Raise baseline shot supply carefully through carrier-action shoot intent,
   protecting goals with paired validation.
2. Tune foul genesis through tackle-attempt and foul-given-tackle probabilities
   before touching card probabilities.
3. Retest corners after shot-volume movement. Tune corner-award paths only if
   corners remain low relative to the new shot volume.
4. Use chance creation as a secondary shot-texture lever, especially if Phase 14
   wants more progressive-pass/cross/cutback shots rather than only more carrier
   self-selected shots.

Out of scope for Phase 14 unless Mo explicitly broadens it: new event
vocabulary, engine refactors, exact pre-roll diagnostic instrumentation,
position-ratings consumption, work-rate consumption, and real-PL source changes.

Phase 14 should use paired seeds and move one mechanism group at a time. The
highest risk is raising shots while goals are already real-PL realistic; every
shot-volume tune needs a goals guardrail.
