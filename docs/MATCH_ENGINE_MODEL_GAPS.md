# Match Engine Model Gaps

Last updated: 2026-05-03 15:35 SAST

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
- Fatigue/stamina: continuous per-tick drain, stamina-scaled movement/action
  effectiveness, and final stamina diagnostics.
- Substitutions: scheduled manual substitutions, AI Auto Subs, substitution
  events, active-player replacement, and persisted substitution summaries.
- Score-state urgency: late/deficit urgency multiplier that shifts pressing,
  passing risk, and carrier action weighting around the user's baseline tactics.
- Chance creation: attacking-third progression and late chase shot intent now
  give score-state urgency a path to extra final-15 shots.
- Taker-aware set pieces: deterministic free-kick, corner, and penalty takers
  are selected from v2 attributes; corners, free kicks, and penalties feed the
  shot pipeline and summary diagnostics.
- True half-time side-switch: new runs flip attacking direction after the
  half-time marker, snapshots expose per-tick attack direction, and old
  persisted runs keep legacy rendering via `sideSwitchVersion`.

## Real-Squad Responsiveness Findings

The 2026-05-03 real-squad harness used Liverpool vs Manchester City over 200
full-match seeds per comparison. It confirmed that responsiveness survives the
real FC25 data path:

- Mentality moved Liverpool shots by +116.03%.
- Pressing moved Liverpool fouls by +216.67%.
- Tempo moved Liverpool possession streaks by -17.40%, which is the
  football-correct direction for faster, riskier play.
- A deliberate manual XI rotation, replacing Van Dijk, Salah, and
  Alexander-Arnold with Chiesa, Gakpo, and Núñez, reduced Liverpool goals by
  19.16% with Auto Subs off.
- Fatigue reduced late action success by 4.26%. This is modest but real, and
  does not include movement-speed and pressing-intensity effects captured
  elsewhere in the engine.
- Auto Subs are active at realistic frequency after anchoring the fatigue
  threshold to the 25th percentile of real-squad minute-70+ stamina samples:
  4.92 total subs/match, 0 zero-sub matches in the 200-seed run.
- Phase 6 score-state shot impact passed: forcing Liverpool 0-2 down at 75:00
  increased final-15 shots by 23.62% (`0.99 -> 1.23`).

See `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md` for the full table.

## Potential Pre-integration Concerns

These are not automatic sprint items. Promote one only if it affects v0.1
agency, public API shape, or obvious UAT realism.

- **Player Manager protagonist tuning**: responsiveness proved a +15 single-player boost moves outcomes, but the absolute lift may need targeted gameplay tuning to feel meaningful.
- **Atatürk initialisation contract**: integration needs a clear half-time state input for score, stats, tactics, selected XI, bench, and user-player state.
- **Manual XI downstream effects**: manual line-ups are now measurable, but the
  engine does not yet model morale, chemistry, familiarity, or
  out-of-position discomfort beyond the attributes and position assignments
  already present.
- **Chance-creation standalone strength**: the isolated chance-creation
  feature flag only moved final-15 shots by +2.05% in the Phase 6 real-squad
  harness. The headline score-state composition passes, but future tuning may
  need to make progression-to-shot behaviour more visible outside chase states.
- **Penalty frequency in real-squad matchups**: synthetic full-match
  characterisation now has enough penalty volume for conversion checks, but the
  Liverpool vs Aston Villa real-squad set-piece diagnostic produced only 0.04
  penalties per match. Re-check when more matchups or referee variance exist.
- **Side-switch interpretation in UAT**: for new runs, the home team attacks a
  different end in the second half. This is intentional and matches real match
  convention. Ball heatmaps stay raw; team-attacking-territory diagnostics are
  direction-aware.

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
