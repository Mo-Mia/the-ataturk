# Calibration Reference

Last updated: 2026-05-03 17:55 SAST

This is the living reference for FootSim calibration. Future sprints that add or
change calibrated constants should update this document in the same commit.

Phase 8 documents current state only. No constants were tuned while writing this
reference.

## How To Read This

- **Provenance**: `empirical` means derived or adjusted from measurement;
  `intuitive` means chosen from football/simulation judgement; `inherited` means
  inherited from earlier calibration where original rationale is unclear.
- **Coverage**: `explicit` means a focused test names the mechanic; `implicit`
  means fixtures, responsiveness, or characterisation catch regressions at a
  higher level; `gap` means Phase 8 should add coverage or backlog it.
- **Sensitivity**: `high`, `medium`, `low`, or `unknown`.

## Phase 9 Lesson: High-Variance Experiments

Manual XI rotation is the canonical warning. Its trajectory across phases was:

```text
-18.37 -> -19.16 -> -13.19 -> -8.09 -> -15.93
```

The apparent Phase 8 decay was resolved by Phase 9's 1000-seed paired analysis:
`-15.93%`, paired SE `4.31pp`, 95% CI `[-24.37%, -7.48%]`.

Methodological rule:

- Low-variance mechanics, such as stamina drain, can be tested at 50-200 seeds.
- Medium-variance composition mechanics should state when 500 seeds are needed.
- Personnel-impact experiments, including manual XI and likely set-piece taker
  quality, need paired-seed analysis at 1000+ seeds before firm conclusions.

Phase 10 added a second case study. Chance creation's exact isolated final-15
measurement moved from Phase 6 `+2.05%` to Phase 8 `-7.14%` to Phase 10
`+2.98%` with a 95% CI crossing zero. The correct conclusion is low
ordinary-context effect, not tuning. Under a forced late deficit, however, the
same toggle produced `+43.99%` final-15 shots across 1000 paired seeds. Future
chance-creation tests must state the tactical context they are measuring.

## Calibration Targets

| Constant | Value | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `CALIBRATION_TARGETS.shotsTarget` | `[8, 12]` per second half | `packages/match-engine/src/calibration/constants.ts:16` | Second-half shot-volume pass band | inherited | explicit via `characterise` | high |
| `goalsTarget` | `[1, 3]` | `constants.ts:18` | Second-half goal pass band | inherited | explicit via `characterise` | high |
| `foulsTarget` | `[4, 8]` | `constants.ts:19` | Second-half foul pass band | inherited | explicit via `characterise` | high |
| `cardsTarget` | `[1, 3]` | `constants.ts:20` | Second-half card pass band | inherited | explicit via `characterise` | high |
| `maxSingleScoreShare` | `0.4` | `constants.ts:21` | Degenerate final-score distribution guard | inherited | explicit via `characterise` | medium |

## Action Selection

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `ACTION_WEIGHTS` | Zone/pressure action matrix for pass, shoot, dribble, hold, clear | `probabilities.ts:39` | Foundational carrier decision rates | inherited | implicit via characterisation and scenario artefacts; Phase 8 adds sensitivity pattern | high |
| `WIDE_CARRIER_ACTION_MODIFIERS` | Wide carriers dribble more in midfield/final third | `probabilities.ts:33` | Wide carrying vs static recycling | empirical from UAT Sessions 5-7 | implicit via carry/delivery UAT artefacts and responsiveness | medium |
| `PASS_TARGET_WEIGHTS` | Wide support, cross/cutback, post-carry delivery/recycle weights | `probabilities.ts:22` | Receiver selection and wide delivery behaviour | empirical from UAT Sessions 4-7 | implicit via UAT artefacts; no focused unit test | high |
| `TACTIC_MODIFIERS.mentality` | Defensive/balanced/attacking action multipliers | `probabilities.ts:57` | Mentality responsiveness | empirical from responsiveness testing | explicit via real-squad responsiveness | high |
| `TACTIC_MODIFIERS.tempo` | Slow/normal/fast action multipliers | `probabilities.ts:63` | Tempo and possession streak behaviour | empirical from responsiveness testing | explicit via real-squad responsiveness | medium |
| `TACTIC_MODIFIERS.pressing` | `0.75`, `1`, `1.3` | `probabilities.ts:68` | Pressing intensity and foul pressure | empirical from responsiveness testing | explicit via real-squad responsiveness | high |

## Action Success

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `SUCCESS_PROBABILITIES.passByZone` | def `1.02`, mid `0.94`, att `0.86` | `probabilities.ts:184` | Pass completion by pitch zone | inherited | implicit via characterisation; Phase 8 adds sensitivity pattern | high |
| `pressureModifier` | low `1`, medium `0.9`, high `0.78` | `probabilities.ts:185` | Pressure effect on pass success | inherited | implicit via pressing responsiveness | high |
| `dribbleBase` / `dribblePressureModifier` | base `0.82`, low/medium/high `0.95/0.75/0.55` | `probabilities.ts:186` | Dribble success | inherited | implicit via chance creation and turnovers | medium |
| `shotOnTargetByZone` | def `0`, mid `0.32`, att `0.58` | `probabilities.ts:191` | Shot accuracy by zone | inherited | implicit via characterisation | high |
| `shotPressureModifier` | low `1`, medium `0.86`, high `0.7` | `probabilities.ts:192` | Pressure effect on shot accuracy | inherited | implicit via characterisation | high |
| `saveBase` | `0.405` | `probabilities.ts:193` | Goalkeeper save probability centre point | empirical Phase 5 | implicit via characterisation | high |
| `tackleAttemptByPressure` | low/medium/high `0.01/0.02/0.034` | `probabilities.ts:194` | Tackle event frequency | inherited | implicit via fouls/cards characterisation | high |
| `tackleSuccessBase` | `0.62` | `probabilities.ts:198` | Tackle success | inherited | implicit via possession/foul outputs | medium |
| `foulOnTackleByPressure` | low/medium/high `0.13/0.16/0.21` | `probabilities.ts:199` | Foul frequency | inherited | implicit via characterisation | high |
| `yellowOnFoul` / `redOnFoul` | `0.25` / `0.012` | `probabilities.ts:203` | Card frequency | empirical from discipline UAT + characterisation | explicit via forced second-yellow artefact, implicit via characterisation | high |
| `failedPassOutOfPlay` / `clearanceOutOfPlay` | `0.055` / `0.14` | `probabilities.ts:205` | Restart and set-piece volume | empirical Phase 6 | implicit via set-piece baseline | medium |
| `shotDistance` | close/box/edge/far/speculative thresholds and multipliers | `probabilities.ts:207` | Shot quality and save difficulty by distance | empirical Phases 3/6 | implicit via characterisation; side-switch tests protect direction | high |

## Weak Foot

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `SHOT_PREFERRED_FOOT_PROBABILITY_BY_WEAK_FOOT_RATING` | 1-star `0.9` to 5-star `0.55` | `probabilities.ts:6` | How often shots use preferred foot | intuitive Phase v2 bridge | implicit via v2 characterisation | medium |
| `SHOT_WEAK_FOOT_MULTIPLIER_BY_RATING` | 1-star `0.72` to 5-star `1` | `probabilities.ts:14` | Weak-foot power/accuracy penalty | intuitive; checked in SA weak-foot experiment | implicit via v2 characterisation | medium |

## Fatigue

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `FATIGUE.baselineDrainPerTick` | `0.0286` | `probabilities.ts:76` | Continuous stamina drain | empirical Phase 5 | explicit via fatigue tests; Phase 8 adds sensitivity | high |
| `movementDrainAtMaxSpeed` / `pressingProximityDrain` | `0.0154` / `0.011` | `probabilities.ts:77` | Movement and pressing stamina cost | empirical Phase 5 | implicit via fatigue tests | medium |
| `FATIGUE.actionDrain` | hold `0.011` to shoot `0.242` | `probabilities.ts:79` | Action-specific stamina cost | intuitive Phase 5 | implicit via fatigue tests | medium |
| `staminaScaling` | low `1.5`, mid `1`, high `0.6` | `probabilities.ts:87` | Attribute effect on drain | intuitive Phase 5 | implicit via fatigue tests | medium |
| `effect` thresholds/multipliers | no penalty above `65`, floors `35/20`, multipliers `0.94/0.82/0.68` | `probabilities.ts:92` | Low-stamina performance degradation | empirical Phase 5 | explicit via responsiveness fatigue impact | high |

## Substitutions

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `SUBSTITUTIONS.maxPerTeam` | `5` | `probabilities.ts:103` | Legal sub cap | football law | explicit via substitution tests | low |
| `aiStartMinute` | `62` | `probabilities.ts:104` | Earliest AI sub trigger | intuitive Phase 5 | implicit via auto-sub responsiveness | medium |
| `fatigueThreshold` | `51` | `probabilities.ts:105` | Fatigue-triggered AI sub threshold | empirical Phase 5 25th percentile | explicit via substitution tests; Phase 8 adds sensitivity | high |
| `cooldownTicks` | `160` | `probabilities.ts:106` | Minimum spacing between AI subs | intuitive Phase 5 | implicit via auto-sub diagnostics | medium |
| `tacticalChaseMinute` / `tacticalDeficit` | `70` / `2` | `probabilities.ts:107` | Late tactical AI sub trigger | intuitive Phase 5 | implicit via auto-sub diagnostics | medium |

## Score State

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `minUrgency` / `maxUrgency` | `0.7` / `1.4` | `probabilities.ts:112` | Urgency clamp | intuitive Phase 5 | explicit via score-state tests | high |
| `levelLateBoost` | last30/15/5 `0.03/0.08/0.12` | `probabilities.ts:114` | Late tied-game urgency | intuitive Phase 5 | implicit via responsiveness | medium |
| `deficitBoost` | one/two/three+ `0.12/0.22/0.3` | `probabilities.ts:119` | Trailing-team urgency | empirical Phase 5/6 | explicit via score-state tests | high |
| `timeFactor` | early `0.25` to last5 `1.2` | `probabilities.ts:124` | Time weighting for urgency | intuitive Phase 5 | explicit via score-state tests | medium |
| `action`, `pressing`, `passRisk`, `lateChaseShotIntent` | action multipliers and risk/shot intent | `probabilities.ts:130` | Applies urgency to behaviour | empirical Phase 6 | implicit via score-state shot-impact responsiveness | high |

## Chance Creation

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `CHANCE_CREATION.sourceBase` | progressive pass `0.055`, through ball `0.12`, carries/crosses/cutbacks `0.075-0.1` | `probabilities.ts:142` | Attacking-third progression into shot opportunity | empirical Phase 6 | implicit via score-state shot impact; Phase 8 adds sensitivity | high |
| `pressure` | low `1`, medium `0.58`, high `0` | `probabilities.ts:151` | Pressure gate on shot opportunity | intuitive Phase 6 | implicit via chance-creation tests/responsiveness | high |
| `distanceBand` | close `1.15`, box `1`, edge `0.62`, far/speculative `0` | `probabilities.ts:152` | Shot opportunity by distance | intuitive Phase 6 | implicit via characterisation | high |
| `urgencyInfluence` and clamp | `0.9`, min `0.8`, max `1.35` | `probabilities.ts:156` | Score-state composition with chance creation | empirical Phase 6 | implicit via score-state shot impact | high |

Phase 10 closed the Phase 8 anomaly. Exact isolated chance creation is
low-effect in ordinary match state, but strongly positive under late forced
deficit. This is a context-sensitive mechanic; tests should not collapse those
contexts into one threshold.

## Set Pieces

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| `SET_PIECES.shotDeflectionCornerByPressure` | low/medium/high `0.025/0.045/0.07` | `probabilities.ts:162` | Corners from blocked/deflected shots | empirical Phase 6 | implicit via set-piece baseline | medium |
| `defensiveClearanceCorner` | `0.46` | `probabilities.ts:166` | Corners from defensive clearances | empirical Phase 6 | implicit via set-piece baseline | high |
| `directFreeKickMaxDistance` | `330` | `probabilities.ts:167` | Direct FK range | intuitive Phase 6 | implicit via set-piece baseline | medium |
| `freeKickDirectShotBase` / `freeKickCrossBase` | `0.42` / `0.62` | `probabilities.ts:168` | FK resolution choice | intuitive Phase 6 | implicit via set-piece tests | medium |
| `penaltyFromFoulByDistanceBand` | close/box/edge `1/0.75/0.28` | `probabilities.ts:170` | Penalty frequency from attacking fouls | empirical Phase 6 | implicit via set-piece baseline | high |
| `cornerShotBase`, `cornerGoalBase` | `0.13`, `0.03` | `probabilities.ts:177` | Corner shot/goal conversion | empirical Phase 6 | explicit via set-piece tests; Phase 8 adds sensitivity | high |
| `directFreeKickGoalBase` | `0.065` | `probabilities.ts:179` | Direct FK conversion | intuitive Phase 6 | implicit via set-piece baseline | medium |
| `penaltyGoalBase` | `0.78` | `probabilities.ts:180` | Penalty conversion | empirical Phase 6 | implicit via set-piece baseline | high |

### Locality Issue

Set-piece taker weights live in `packages/match-engine/src/state/initState.ts:170`
instead of a calibration module:

- FK: free-kick accuracy `0.45`, shot power `0.25`, curve `0.15`, composure `0.15`.
- Corner: crossing `0.55`, vision `0.25`, curve `0.2`.
- Penalty: penalties `0.55`, composure `0.3`, shot power `0.15`.

They are explicitly tested in `packages/match-engine/test/resolution/setPieces.test.ts`,
but their location is a calibration-locality issue and is tracked in BACKLOG.

## Momentum And Movement

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| Momentum cap/decay | max `100`, possession decay `0.97`, out-of-possession `0.88`, turnover retention `0.35` | `state/momentum.ts:5` | Attack momentum accumulation and decay | empirical UAT Sessions 7-8 | explicit via momentum tests | medium |
| Momentum event deltas | progressive pass `+6`, shot `-12`, corner/FK `+4`, etc. | `state/momentum.ts:69` | Event-driven momentum changes | intuitive/empirical Phase post-v2 | explicit via momentum tests | medium |
| Movement base constants | base speed `10`, press distance `230`, tackle involvement `74` | `ticks/movement.ts:15` | Kinematic speed and defensive involvement | empirical UAT Sessions 4-8 | explicit via runTick movement tests | high |
| Shape constants | wide anchor `0.85`, central anchor `0.55`, tuck values `70/72`, channel edges | `ticks/movement.ts:18` | Shape preservation and ball-side shifting | empirical UAT Sessions 4-8 | explicit via runTick movement tests | high |

## Personnel Selection

| Constant group | Value summary | Location | Controls | Origin | Coverage | Sensitivity |
| --- | --- | --- | --- | --- | --- | --- |
| Formation templates | Four supported XI role templates | `packages/data/src/fc25/selectStartingXI.ts:13` | Formation-aware starting XI order | football convention Phase 3 | explicit via XI tests | high |
| Fallback adjacency | Role fallback table | `selectStartingXI.ts:20` | Out-of-position selection fallback | intuitive Phase 3 | explicit via XI tests | medium |
| Manual XI threshold | `7%` at 200 seeds; Phase 9 diagnostic `15.93%` at 1000 paired seeds | `packages/data/src/fc25/realSquadResponsiveness.ts` | Responsiveness pass threshold | empirical Phase 9 | explicit via responsiveness harness | high variance |

## Coverage Gaps To Carry Forward

- `PASS_TARGET_WEIGHTS` needs focused sensitivity coverage if wide-delivery work is
  touched again.
- Set-piece taker weights should move from `initState.ts` to a dedicated
  calibration module.
- The isolated chance-creation toggle anomaly needs a future investigation
  before any threshold/tuning decision.
