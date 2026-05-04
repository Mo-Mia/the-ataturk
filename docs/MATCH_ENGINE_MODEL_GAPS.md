# Match Engine Model Gaps

Last updated: 2026-05-04 09:52 SAST

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

- Mentality moved Liverpool shots by +131.02%.
- Pressing moved Liverpool fouls by +257.38%.
- Tempo moved Liverpool possession streaks by -18.51%, which is the
  football-correct direction for faster, riskier play.
- A deliberate manual XI rotation, replacing Van Dijk, Salah, and
  Alexander-Arnold with Chiesa, Gakpo, and Núñez, reduced Liverpool goals by
  15.93% over the Phase 9 1000-seed paired investigation. Phase 8's 200-seed
  `-8.09%` result was sampling/threshold noise, not a structural decay.
- Fatigue reduced late action success by 3.54%. This is modest but real, and
  does not include movement-speed and pressing-intensity effects captured
  elsewhere in the engine.
- Auto Subs are active at realistic frequency after anchoring the fatigue
  threshold to the 25th percentile of real-squad minute-70+ stamina samples:
  4.87 total subs/match, 0 zero-sub matches in the 200-seed run.
- Phase 6 score-state shot impact passed: forcing Liverpool 0-2 down at 75:00
  increased final-15 shots by 29.74% (`0.98 -> 1.27`).
- Phase 8 locked a machine-readable calibration baseline and documented the
  calibration surface in `docs/CALIBRATION_REFERENCE.md`.
- Phase 10 closed the chance-creation isolated-toggle anomaly. Exact isolated
  chance creation is low-effect (`+2.98%` final-15 home shots, CI crosses zero),
  but forced-deficit final-15 home shots rise by `+43.99%` across 1000 paired
  seeds.

See `docs/FOOTSIM_REAL_SQUAD_RESPONSIVENESS.md` for the full table.

## FC26 Baseline Findings

Phase 11 measured the engine against the FC26-active runtime dataset. Tactical
responsiveness remains healthy, and manual XI impact is strong. The revealed
gap is calibration interpretation: real-squad FC26 Liverpool vs Manchester City
event volume is below the old synthetic Phase 8 target bands for shots, fouls,
and cards. Decide whether to create real-squad FC26 characterisation bands or
keep synthetic targets as the only calibration gate before tuning.

FC26 also exposes richer data that is still deliberately unused by the engine:
`position_ratings_json`, `work_rate`, body data, traits, and tags. These remain
Phase 12+ candidates because consuming them would change behaviour and needs a
calibrated sprint.

## Potential Pre-integration Concerns

These are not automatic sprint items. Promote one only if it affects v0.1
agency, public API shape, or obvious UAT realism.

- **Player Manager protagonist tuning**: responsiveness proved a +15 single-player boost moves outcomes, but the absolute lift may need targeted gameplay tuning to feel meaningful.
- **Atatürk initialisation contract**: integration needs a clear half-time state input for score, stats, tactics, selected XI, bench, and user-player state.
- **Manual XI downstream effects**: manual line-ups are now measurable, but the
  engine does not yet model morale, chemistry, familiarity, or
  out-of-position discomfort beyond the attributes and position assignments
  already present.
- **Chance creation outside chase contexts**: Phase 10 confirmed exact isolated
  chance creation has low ordinary-match effect. This is accepted for now
  because the forced-deficit signal is strong, but UAT may still ask for
  progressive carries and through-balls to change open-play shot texture more
  visibly outside late chase states.
- **Penalty frequency in real-squad matchups**: synthetic full-match
  characterisation now has enough penalty volume for conversion checks, but the
  Liverpool vs Aston Villa real-squad set-piece diagnostic produced only 0.04
  penalties per match. Re-check when more matchups or referee variance exist.
- **Side-switch interpretation in UAT**: for new runs, the home team attacks a
  different end in the second half. This is intentional and matches real match
  convention. Ball heatmaps stay raw; team-attacking-territory diagnostics are
  direction-aware.
- **Real-squad vs synthetic calibration gates**: Phase 11 showed FC26 real-squad
  event volume can fall below the old synthetic target bands while
  responsiveness still passes. This is a calibration-policy question before it
  is an engine-tuning question.

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
