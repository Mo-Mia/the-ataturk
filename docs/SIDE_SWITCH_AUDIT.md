# FootSim Phase 7 — Side-Switch Audit

Date: 2026-05-03

Status: Strand A audit for review. No implementation has landed from this
document yet.

## Purpose

Phase 7 introduces true half-time side-switching: after the `half_time` event at
tick 900, each team attacks the opposite goal. This is a fidelity refactor only.
It must preserve match behaviour on average while changing spatial output.

Validation principle:

- Side-switch OFF and side-switch ON should be statistically indistinguishable
  across calibration metrics.
- Individual match spatial output should differ because teams change ends.
- If validation drifts, investigate direction read sites or RNG divergence. Do
  not tune calibration constants.

## Direction State Design

Add explicit per-team direction state to mutable match state:

```ts
type AttackDirection = 1 | -1;

attackDirection: {
  home: AttackDirection;
  away: AttackDirection;
}
```

Meaning:

- `1` means attacking toward `y = PITCH_LENGTH`.
- `-1` means attacking toward `y = 0`.

Initial direction:

- First half: `home = 1`, `away = -1`.
- Full-match tick 900 with side-switch enabled: both directions are multiplied
  by `-1`.
- `sideSwitch: false`: legacy behaviour, directions never flip.

Important semantic change:

- `second_half` runs now initialise in post-half-time direction when side-switch
  is enabled: `home = -1`, `away = 1`.
- This is semantically correct because the match clock starts at 45:00.
- It is a semantic change with no expected statistical impact, validated via the
  500-seed A/B test.
- Legacy persisted second-half runs without a side-switch version continue to
  render with old fixed-direction interpretation.

## Runtime Flag And Versioning

Add a validation-only dynamics flag:

```ts
dynamics: {
  sideSwitch?: boolean;
}
```

Defaults:

- Engine default for new runs: `sideSwitch = true`.
- A/B harness can set `sideSwitch = false`.
- Production workbench paths do not expose this as a user tactic.

Persisted/snapshot versioning:

- New snapshots include `meta.sideSwitchVersion = 1`.
- New ticks include the current `attackDirection`.
- New persisted run summaries include `sideSwitchVersion = 1`.
- Missing or `0` means legacy no-switch behaviour.
- Add a migration that backfills existing `match_runs.summary.sideSwitchVersion`
  to `0` where missing.

## Formation And Reset Semantics

Current formation anchors are first-half oriented:

- Home uses the template directly.
- Away is mirrored across pitch centre.

With side-switch enabled:

- At half-time, active player anchors rotate through pitch centre:
  `x = PITCH_WIDTH - x`, `y = PITCH_LENGTH - y`.
- Player `lateralAnchor`, `anchorPosition`, and reset `targetPosition` follow
  the rotated anchor.
- The half-time reset then places players into their new-end formation shape.
- Bench players inherit the team direction when substituted in; their role
  anchor is derived from the current team orientation.

With side-switch disabled:

- Existing anchor/reset behaviour is preserved.

## Engine Read-Site Audit

| Surface | Current assumption | Required Phase 7 change | Test expectation |
| --- | --- | --- | --- |
| `zones/pitchZones.ts` | `zoneForPosition(teamId, position)` assumes home attacks high `y`, away low `y`. `attackDirection(teamId)` is fixed. | Keep legacy helpers for old/default contexts, add direction-aware pure helpers for zone, normalised attacking Y, and attack direction. Stateful call sites pass `state.attackDirection[teamId]`. | Same coordinate classifies as attacking/defensive based on supplied direction. Mirrored positions classify equivalently. |
| `resolution/shotDistance.ts` | Attacking goal centre is fixed by team ID. | Add direction-aware shot-distance helper. Stateful call sites calculate distance to the current opponent goal. | Same shooter mirrored after direction flip gets the same distance band and modifiers. |
| `state/initState.ts` | No direction state. `second_half` changes clock only. | Initialise `attackDirection`, derive `sideSwitchVersion`, rotate initial shape for new `second_half` side-switch runs. | `full_90` starts home `1`; new `second_half` starts home `-1`; `sideSwitch: false` stays legacy. |
| `ticks/runTick.ts` | Half-time emits marker, resets ball, gives away kickoff, but does not flip direction. Possession-zone events use legacy zone helper. | Flip direction and rotate anchors before second-half kickoff when enabled. Use direction-aware zone for kickoff and loose-ball possession changes. | Tick 900 emits `half_time`; following ticks show flipped direction and correct possession zone. |
| `ticks/movement.ts` | Carrier dribbles, support offsets, kickoff targets, run targets, wide runs, overlaps, and momentum support use fixed team direction. | Read current team direction for every forward/backward movement calculation. Use direction-aware attacking progress. | Carrier movement and support runs mirror after direction flip without changing speed/range constants. |
| `state/momentum.ts` | `attackingThirdProgress(teamId, y)` is fixed by team ID. | Add direction-aware progress helper or pass direction from call sites. Momentum remains kinematic-only. | Same mirrored attack has equivalent progress and momentum support effect. |
| `resolution/actions/pass.ts` | Progressive target filtering, score-state risk, wide target adjustment, forward-run bonus, key-pass context, and shot-capable distance use fixed direction/zone. | Use current direction for progress, target preference, zone, and shot-distance context. | Mirrored pass scenario chooses equivalent progressive/attacking interpretation. |
| `resolution/actions/dribble.ts` | Successful dribbles and wide carries advance by fixed team direction. | Use current direction for forward carry and zone after carry. | Successful dribble advances toward current attacking goal in both halves. |
| `resolution/actions/clearance.ts` | Clearance target and defensive-zone corner risk use fixed direction/zone. | Use current direction for clearance target and direction-aware defensive-zone checks. | Clearance from mirrored defensive zones behaves equivalently. |
| `resolution/actions/tackle.ts` | Foul severity's behind-carrier check uses fixed direction; penalty likelihood uses fixed shot distance. | Use current direction for behind-carrier and shot-distance context. | Same mirrored tackle produces equivalent severity/penalty context. |
| `resolution/actions/shot.ts` | Shot distance and goal ball position use fixed team goal. | Use current direction for shot-distance context and goal-line ball position. | Mirrored shot has equivalent distance band; a goal places the ball in the current attacked goal. |
| `resolution/chanceCreation.ts` | Opportunity gating uses fixed zone and shot distance. | Use current direction for attacking-third gating and shot distance. | Mirrored attacking-third progression has equivalent shot-opportunity chance. |
| `resolution/carrierAction.ts` | Shoot weighting and late-chase shot intent use fixed shot distance / possession zone. | Use direction-aware shot distance and zone as fed by state. | Mirrored carrier in equivalent attacking position gets equivalent action weights. |
| `resolution/pressure.ts` | Possession-change detail emits zone from fixed helper. | Emit direction-aware zone detail. Pressure proximity itself remains direction-neutral. | Possession-change zone mirrors correctly after half-time. |
| `resolution/setPieces.ts` | Corner side, penalty spot, free-kick directness, set-piece restart targets, loose-ball targets, and goal-kick position rely on fixed direction. | Use current direction for attacked goal, own goal, restart target, delivery target, direct-free-kick distance, and loose set-piece target. Behaviour stays unchanged except direction correctness. | Corner, penalty, FK, and goal-kick positions mirror correctly when direction flips. |
| `snapshot.ts` | Shape diagnostics normalise home as high `y`, away as low `y`. | Include tick `attackDirection`; normalise line height, thirds, opposition-half count, and attacking depth by current direction. | First-half and second-half attacking-shape diagnostics are comparable. |

## Visualiser And Diagnostics Audit

| Surface | Current assumption | Required Phase 7 change | Test expectation |
| --- | --- | --- | --- |
| Snapshot loading | No side-switch version. | Infer `sideSwitchVersion = 0` when missing; use snapshot meta/version or run summary when present. | Old artefacts load and replay. |
| Pitch replay | Raw coordinates are rendered directly. | Continue rendering raw engine coordinates; side-switch is represented by the engine output, not by visually rewriting ticks. | New runs visibly attack opposite ends after half-time. Old runs remain unchanged. |
| HeatmapPanel ball heatmap | Raw coordinates only. | For team/attacking diagnostics, normalise coordinates by team direction per tick. Ball-only raw heatmap can remain raw, but attacking-territory stats become direction-aware. | New home attacking heatmap combines first- and second-half attacking territories correctly. |
| Player-relative heatmap | Away relative Y is inverted by fixed team ID. | Invert/normalise relative Y from the selected player's current attacking direction. | A player's relative-to-ball heatmap remains comparable across halves. |
| StatsPanel territory | Home attacking third is high `y`; away attacking third is low `y`. | Use tick direction/version for attacking-third and possession-territory calculations. | Old missing-version runs use legacy logic; new version `1` runs use direction-aware logic. |
| Compare/batch views | Consume shared stats/heatmap components. | Inherit side-switch-aware behaviour from shared components. | Comparing old and new runs does not crash; old/new interpretation remains explicit. |

## A/B Validation Design

Add a side-switch A/B harness:

- 500 seeds with `sideSwitch: false`.
- 500 seeds with `sideSwitch: true`.
- Same seed set and match configuration.
- Metrics: shots, goals, fouls, cards, possession, corners, set-piece goals.
- For each metric, compute mean, standard error, pooled standard error, and
  absolute difference.
- Pass criterion: `abs(meanOff - meanOn) < 2 * pooledSE`.

If any metric fails:

1. Check whether RNG consumption changed between modes in a representative
   match by counting RNG calls.
2. If RNG call counts are identical, treat the failure as a bug in a refactored
   direction read site.
3. If RNG call counts differ, investigate the read site that introduced
   mode-dependent RNG consumption before judging behavioural drift.
4. Do not tune calibration constants.

## Spatial Validation Design

For 50 side-switch ON runs:

- Inspect home-team heatmap/territory by half.
- Confirm first-half and second-half raw territory appear at opposite pitch
  ends.
- Confirm direction-normalised attacking territory combines correctly.
- Document findings in markdown; image artefacts are optional and not required.

## Forced Fixture

Add `packages/match-engine/scripts/forcedSideSwitch.ts`.

Scenario:

- Build a full-90 v2 run.
- Script a meaningful state around tick 895: stable possession near midfield
  with active players in shape.
- Let the natural tick 900 `half_time` boundary fire.
- Verify `half_time` event emission, direction flip, second-half kickoff, and
  second-half attacking movement toward the new goal.
- Write `packages/match-engine/artifacts/forced-side-switch-v2.json`.

## Commit Boundary

This audit is Strand A only. Strand B should not begin until this document is
reviewed and approved.
