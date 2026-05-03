# Match Engine Model Gaps

Last updated: 2026-05-03 11:03 SAST

Purpose: keep the pre-integration engine review honest. This document lists what
the standalone match engine currently models, what it does not model yet, and
which gaps matter before The Atatürk integration or the next FootSim maturity
sprint.

## Modelled Now

- Possession-zone match state: team in possession, defensive/midfield/attacking zone, pressure level.
- 3-second fixed ticks, 900 ticks per second half.
- Multi-stage action resolution: movement, ball physics, pressure/tackle, carrier action, semantic events.
- Calibrated football events: shots, goals, saves, fouls, cards, corners, throws, goal kicks, free kicks, kick-offs, full time.
- Goal state machine: celebration pause, centre reset, conceding-team kick-off.
- Discipline state: yellow accumulation, second-yellow red, player removal, 10-man continuation.
- Wide play: wide carries, flank progressions, crosses, cutbacks, and same-flank support.
- Off-ball movement: lateral anchors, ball-side shifting, role-sensitive support runs, movement smoothing.
- Attack momentum: kinematic-only pressure signal that affects support movement, not shot/goal probabilities.
- v1/v2 player input bridge: v2 metadata preserved, v1 internals retained, preferred foot consumed for shots.
- Deterministic snapshots, characterisation scripts, responsiveness harness, and visualiser replay/heatmap diagnostics.
- Full-90 workbench runs with `half_time` and `full_time` markers.
- Formation-aware FC25 starter-XI selection and manual XI override through the
  workbench.
- Persisted run history, comparison view, batch distribution view, and basic
  run-history filtering.

## Real-Squad Responsiveness Findings

The 2026-05-03 real-squad harness used Liverpool vs Manchester City over 50
full-match seeds per comparison. It confirmed that responsiveness survives the
real FC25 data path:

- Mentality moved Liverpool shots by +172.78%.
- Pressing moved Liverpool fouls by +261.29%.
- Tempo moved Liverpool possession streaks by -16.67%, which is the
  football-correct direction for faster, riskier play.
- A deliberate manual XI rotation, replacing Van Dijk, Salah, and
  Alexander-Arnold with Chiesa, Gakpo, and Núñez, reduced Liverpool goals by
  18.37%.
- Formation shape is strongly visible: Liverpool `4-3-3` produced +247.19%
  wide deliveries versus `4-4-2`.

See `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md` for the full table.

## Potential Pre-integration Concerns

These are not automatic sprint items. Promote one only if it affects v0.1
agency, public API shape, or obvious UAT realism.

- **Real substitution API**: current responsiveness swap is explicitly test-only. Integration needs bench state, player replacement, formation rebalancing, event emission, and UI-safe semantics.
- **Player Manager protagonist tuning**: responsiveness proved a +15 single-player boost moves outcomes, but the absolute lift may need targeted gameplay tuning to feel meaningful.
- **Game-state management**: teams do not yet explicitly waste time, chase games more urgently, protect leads, or alter risk based on score/minute beyond current tactical inputs.
- **Fatigue/stamina**: v2 has stamina metadata, but match resolution does not yet drain energy or lower late-game actions.
- **Atatürk initialisation contract**: integration needs a clear half-time state input for score, stats, tactics, selected XI, bench, and user-player state.
- **Manual XI downstream effects**: manual line-ups are now measurable, but the
  engine does not yet model morale, chemistry, familiarity, fatigue, or
  out-of-position discomfort beyond the attributes and position assignments
  already present.

## Deferred Unless UAT Finds A Blocker

- Injuries and injury substitutions.
- Referee personality and match-to-match officiating variance.
- Weather, pitch condition, and venue effects.
- Detailed set-piece routines.
- Deeper aerial-duel and heading dominance modelling.
- Goalkeeper distribution nuance, including gkKicking usage.
- Morale/composure swings after goals, red cards, or late misses.
- Team chemistry, form, familiarity, and individual confidence.
- Richer role system beyond current position/tactic heuristics.
- Tactical asymmetry by side or named flank.
- Manual line-up presets and drag-and-drop UX.

## Working Rule

Do not add mechanics just because they are absent. The engine is currently
calibrated and responsive; new mechanics should earn their place by solving a
specific UAT, integration, or gameplay-agency problem.
