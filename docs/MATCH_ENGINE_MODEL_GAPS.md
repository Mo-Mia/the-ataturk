# Match Engine Model Gaps

Last updated: 2026-05-01 16:25 SAST

Purpose: keep the pre-integration engine review honest. This document lists what
the standalone match engine currently models, what it does not model yet, and
which gaps matter before The Atatürk integration.

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

## Potential Pre-integration Concerns

These are not automatic sprint items. Promote one only if it affects v0.1
agency, public API shape, or obvious UAT realism.

- **Real substitution API**: current responsiveness swap is explicitly test-only. Integration needs bench state, player replacement, formation rebalancing, event emission, and UI-safe semantics.
- **Player Manager protagonist tuning**: responsiveness proved a +15 single-player boost moves outcomes, but the absolute lift may need targeted gameplay tuning to feel meaningful.
- **Game-state management**: teams do not yet explicitly waste time, chase games more urgently, protect leads, or alter risk based on score/minute beyond current tactical inputs.
- **Fatigue/stamina**: v2 has stamina metadata, but match resolution does not yet drain energy or lower late-game actions.
- **Atatürk initialisation contract**: integration needs a clear half-time state input for score, stats, tactics, selected XI, bench, and user-player state.

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

## Working Rule

Do not add mechanics just because they are absent. The engine is currently
calibrated and responsive; new mechanics should earn their place by solving a
specific UAT, integration, or gameplay-agency problem.
