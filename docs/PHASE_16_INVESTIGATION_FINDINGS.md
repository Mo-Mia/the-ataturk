# Phase 16 Investigation Findings — Corner-Generation Pathway Gap

Date: 2026-05-04  
Sprint shape: investigation only; no engine code changes

## Summary

Phase 14b closed shot, goal, foul, and card volume against the PL20 real-PL
bands, but corner tuning saturated just below the target floor. The best
measured Phase 14b corner output is `6.52` corners/match against the real-PL
band `[6.7, 13.2]` and centre `9.93`.

The important finding is structural rather than numeric. Existing corner
probability tuning has reached the ceiling of the current event vocabulary:
`defensiveClearanceCorner` values above `1.0` are effectively certain on the
eligible clearance branch, and C5 (`1.058`) produced the same aggregate as C4
(`1.012`). Closing the remaining gap should not continue by raising that
probability. Phase 17 should add or broaden corner-eligible pathways.

Current repo state at Phase 16 start:

- Committed: Phase 15 alpha shot/goal/score-state recovery and Phase 14b B1
  foul tuning (`c2ef557`).
- Uncommitted: C5 corner constants only:
  `shotDeflectionCornerByPressure ×2.5` and
  `defensiveClearanceCorner = 1.058`.
- Not yet landed: formal Phase 14b full responsiveness lock, Phase 8
  retirement, and Phase 14b baseline documentation.

## Strand A — Engine Pathway Audit

### Existing Corner Emitters

| Pathway | Code path | Gate | Current committed value | C5 value | Phase 13 contribution |
| --- | --- | --- | ---: | ---: | ---: |
| Deflected missed shot | `packages/match-engine/src/resolution/actions/shot.ts:64-70` calls `awardCorner(..., "deflected_shot")` when an off-target shot passes the deflection-corner roll | `SET_PIECES.shotDeflectionCornerByPressure[pressure]` | low `0.025`, medium `0.045`, high `0.07` | low `0.0625`, medium `0.1125`, high `0.175` | `0.476` corners/match |
| Defensive clearance out at byline | `packages/match-engine/src/resolution/actions/clearance.ts:11-24` calls `awardCorner(..., "defensive_clearance")` when a defensive-zone clearance first goes out of play, then passes the corner roll | `SUCCESS_PROBABILITIES.clearanceOutOfPlay` then `SET_PIECES.defensiveClearanceCorner` | `0.14`, then `0.46` | `0.14`, then `1.058` | `1.514` corners/match |
| Corner award and restart | `packages/match-engine/src/resolution/setPieces.ts:76-105` increments team corners, emits a corner restart, and sets possession in the attacking zone | reason union permits only `"deflected_shot" \| "defensive_clearance"` | n/a | n/a | output sink |

Phase 13 measured `1.99` corners/match: `0.476` from deflected shots and
`1.514` from defensive clearances. Phase 14b tuning raised the measured output
to `6.52` corners/match at C4/C5 while keeping set-piece goal share realistic
at `10.32%`.

### Saturation

`defensiveClearanceCorner` is compared directly with `rng.next()`. Any value
greater than or equal to `1.0` is an effective certainty on that branch.
Therefore C4 (`1.012`) and C5 (`1.058`) are functionally equivalent for the
corner-given-eligible-defensive-clearance roll. The remaining lever is not
probability on that branch; it is the frequency of eligible clearance events or
new corner-eligible pathways.

### Near Misses

| Near miss | Engine state today | Why it matters |
| --- | --- | --- |
| Goalkeeper save/parry wide | `shot.ts:88-101` emits `save` and gives possession to the keeper. There is no save-result branch that awards a corner. | Real football often produces corners when a keeper pushes a shot wide or over the bar. FootSim currently turns every save into keeper possession. |
| Blocked cross / cutback / wide delivery | Crosses and cutbacks are chance-creation/pass contexts, but failed deliveries either recycle through pass failure, turnover, or chance creation; no byline block can become a corner. | Wide attacking pressure is a major real source of corners and is only indirectly represented. |
| Byline tackle or duel deflection | Tackles resolve as foul, won, or missed. Won tackles immediately change possession; no ball-out-over-goal-line outcome exists. | Defenders often block or poke the ball behind under pressure near the byline. |
| Failed dribble at byline | Failed dribbles become immediate opponent possession. | Wide carries are modelled, but defensive deflections behind from those carries are not. |
| Goal-line clearance / desperate block | Defensive clearances exist, but not goal-line emergency clearances or blocked shots travelling behind after goalmouth pressure. | This is lower frequency but high salience and feeds realistic corner texture. |
| Aerial defensive header behind | There is no aerial-duel or headed-clearance event vocabulary. | A common pathway from crosses, free kicks, and sustained pressure is absent. |

## Strand B — Real-Football Taxonomy

Definition anchor: IFAB Law 17 states a corner is awarded when the whole ball
passes over the goal line, on the ground or in the air, last touched by a
defending player, and no goal is scored:
https://www.theifab.com/laws/latest/the-corner-kick/

Aggregate benchmark anchors:

- Football-Data.co.uk notes define `HC` / `AC` as home/away team corners and
  provide the aggregate data used by Phase 12:
  https://www.football-data.co.uk/notes.txt
- The 2025 systematic review of male-football corner kicks reports that corner
  kicks occur approximately `9.8` to `10.6` times per match and that goals from
  corners are rare, around `2.2%` to `4.43%`:
  https://www.mdpi.com/2076-3417/15/9/4984/html
- FBref public passing-type tables expose corner kick counts and delivery
  categories (`CK`, `In`, `Out`, `Str`) but not corner-causing pathways:
  https://fbref.com/en/comps/9/passing_types/Premier-League-Stats

Public sources give strong aggregate and execution evidence, but not a rigorous
public pathway split for what caused each corner. The taxonomy below therefore
uses IFAB's law definition plus qualitative football consensus and engine
coverage analysis. Relative weights are intentionally coarse.

| Real-football pathway | Rough weighting | Evidence quality | Engine status |
| --- | --- | --- | --- |
| Saved/parried shots wide or over | High | Qualitative consensus; direct consequence of Law 17 | Missing |
| Blocked shots deflected behind | High | Qualitative consensus; directly covered by Law 17 | Covered, tuned but still limited by shot and block supply |
| Crosses/cutbacks blocked behind | High | Qualitative consensus; wide-play pathway | Missing/partially covered |
| Defensive clearances behind | High | Qualitative consensus; directly covered by Law 17 | Covered, probability saturated |
| Byline tackles/duels deflected behind | Medium | Qualitative consensus | Missing |
| Defensive headers behind from crosses/FKs | Medium | Qualitative consensus; aerial-duel pathway | Missing |
| Goal-line clearances / emergency blocks | Low-medium | Qualitative consensus | Missing |
| Miscellaneous keeper/distribution/defender errors behind | Low | Qualitative consensus | Missing |

The taxonomy accounts for the practical ways a defending touch sends the ball
over the goal line. It also explains why two existing FootSim pathways can get
close to the lower band but not to the real-PL centre: several ordinary
real-football pathways are absent, not merely under-tuned.

## Strand C — Gap Analysis

| Pathway | Classification | Gap-closing approach | Estimated contribution |
| --- | --- | --- | ---: |
| Deflected missed shots | Covered, under-calibrated but tuneable | Keep C3/C5 deflection-corner lift; future implementation can enrich blocked-shot outcomes if needed. | Already contributes meaningfully after C tuning; extra likely modest. |
| Defensive clearances | Covered, saturated | Do not raise `defensiveClearanceCorner` further. Raise eligible clearance trigger supply only if clearances are too rare, or add richer clearance event types. | Capped at current eligible-trigger supply; saturation around C4/C5. |
| Keeper saves wide | Missing | Add a save result branch such as `saved_wide_corner` before keeper possession is granted. | High: likely the cleanest missing source, with low effect on shots/goals if save probability is unchanged. |
| Cross/cutback blocked behind | Partially covered | Add a byline/wide-delivery block outcome in pass/chance-creation resolution. | High: likely needed to move from floor toward centre. |
| Byline tackle/duel behind | Missing | Extend successful-tackle/failed-dribble resolution near the defending goal line with a behind-deflection outcome. | Medium. |
| Aerial defensive header behind | Missing | Requires aerial-duel/header event vocabulary. | Medium but higher implementation cost. |
| Goal-line emergency block | Missing | Add a rare close-range shot/save/block branch. | Low-medium, high salience. |

Estimated remaining gap after C5 is `~0.18` corners/match to the Phase 14b
floor and `~3.4` corners/match to the real-PL centre. If the goal is merely to
enter the one-SD band, a single small implementation such as keeper-save-wide
corners may be sufficient. If the goal is to move toward the centre, Phase 17
should include at least keeper-save-wide and blocked wide-delivery pathways.

## Strand D — Phase 17 Recommendation

### Recommendation Matrix

| Priority | Opportunity | What it requires | Expected effect | Risk |
| --- | --- | --- | --- | --- |
| 1 | Save/parry wide to corner | Add a save-result branch in `shot.ts` before `givePossession`; expand `awardCorner` reason union. | Enough to close the `0.18` floor miss; could add more depending on probability. | Low-medium. Must not alter save probability or goal conversion. |
| 2 | Blocked wide delivery to corner | Add a corner-eligible branch for failed crosses/cutbacks or wide final-third passes. | Likely high; moves corners toward centre and improves texture. | Medium. Touches pass/chance-creation paths and may affect turnovers/throws. |
| 3 | Byline duel/tackle behind | Add a near-goal-line successful-tackle/failed-dribble branch to corner. | Medium. | Medium. Could interact with foul and pressing responsiveness. |
| 4 | Clearance trigger-frequency expansion | Increase frequency of eligible defensive clearances, not corner probability. | Medium if clearance supply is low. | Medium-high. More clearances can suppress shots and alter possession texture. |
| 5 | Aerial defensive headers behind | New aerial-duel/header vocabulary. | Medium. | High; likely a separate fidelity sprint. |

### Proposed Phase 17 Sprint Shape

1. Implement save/parry-wide corners first, with a small probability grid and
   PL20 validation. Acceptance: corners enter `[6.7, 13.2]`; shots/goals/fouls/
   cards remain in band.
2. If the floor is still missed or centre movement is desired, add blocked
   wide-delivery corners as the second pathway.
3. Re-run full responsiveness, side-switch spot check, and set-piece goal-share
   guard after the final selected pathway.
4. Only after Phase 17 lands should Phase 14b be locked and Phase 8 retired.

### Phase 14b State Recommendation

Hold the uncommitted C5 corner constants for now. Do not ship them as the final
Phase 14b baseline before Phase 17 because they still miss the corner band and
the investigation shows the miss is caused by missing/saturated pathways rather
than a simple probability value. B1 foul tuning is already committed and should
remain. Phase 17 should decide whether to retain C5's deflection/clearance
constants as the starting point or replace them with lower constants once new
corner pathways are added.

If Phase 17 proves larger than one sprint, the fallback is to commit a partial
Phase 14b baseline with C5 and document corners as known-low (`6.52` vs `6.7`
floor). That should be an explicit Mo/SA decision, not the default.

## Sources

- IFAB, Law 17 — The Corner Kick:
  https://www.theifab.com/laws/latest/the-corner-kick/
- Football-Data.co.uk notes, match-stat column definitions:
  https://www.football-data.co.uk/notes.txt
- Plakias, Armatas, Giakas (2025), Technical-Tactical Analysis of Corner Kicks
  in Male Soccer: A Systematic Review:
  https://www.mdpi.com/2076-3417/15/9/4984/html
- FBref Premier League passing types:
  https://fbref.com/en/comps/9/passing_types/Premier-League-Stats
