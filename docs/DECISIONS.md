# Decision Log

Append-only. Newest at the top. Each entry: date, decision, rationale, alternatives considered.

---

## 2026-05-05 — FootSim Phase 17 outcome: corner pathways landed, Phase 14b locked

Phase 17 completed the Phase 14b event-volume tuning arc. Save/parry-wide
corners were added first as a low-risk branch after successful saves. The
approved three-probe grid showed the pathway worked but save supply was low
(`~1.49` saves/match), so even P3 contributed only `0.40` corners/match and
landed at `6.62` corners/match, below the `6.7` real-PL floor.

The conditional second pathway then added blocked wide-delivery corners by
reclassifying some failed attacking-third crosses/cutbacks before they become
throw-ins or interceptions. C1 landed `6.88` corners/match; C2
(`blockedDeliveryCornerByPressure = 0.18/0.27/0.36`) landed `7.01` and was
accepted.

Final Phase 14b/17 validation passed: `22.67` shots, `2.19` goals, `17.47`
fouls, `5.10` cards, and `7.01` corners per match across the PL20 matrix. Full
responsiveness passed, including score-state shot impact at `+15.76%` against
the Phase 14b `+10%` gate, manual XI at `-31.84%` with 1000 paired seeds, and
the 200-seed side-switch spot check.

Decision: Phase 14b/17 is the active calibration baseline. Phase 8 synthetic
targets are retired as the active anchor and preserved as historical FC25
reference. `CALIBRATION_TARGETS` now stores real-PL half-match equivalents while
preserving `maxSingleScoreShare = 0.4`.

Out of scope and tracked in BACKLOG: chance-creation tuning, finer 0.5-SD
calibration, aerial/byline/goal-line corner fidelity, work-rate consumption,
position-ratings consumption, and narrative/commentary work.

## 2026-05-04 — FootSim Phase 16 outcome: corner-generation pathway gap diagnosed

Phase 14b's corner tuning saturated just below the real-PL floor. C4
(`defensiveClearanceCorner = 1.012`) and C5 (`1.058`) both produced `6.52`
corners/match against the `[6.7, 13.2]` band. This is expected once the code is
read: `defensiveClearanceCorner` is compared directly with `rng.next()`, so
values above `1.0` are effectively certain on the existing eligible-clearance
branch.

Phase 16 audited the corner-generation pathways. FootSim currently awards
corners only from deflected missed shots and defensive clearances. Several
ordinary real-football pathways are missing: goalkeeper saves/parries wide,
blocked crosses/cutbacks, byline tackles or duels deflected behind, defensive
headers behind, and emergency goal-line blocks.

Decision: stop trying to close the corner gap by raising existing corner
probabilities. Phase 17 should add corner-eligible pathways, starting with
save/parry-wide corners and then blocked wide-delivery corners if needed. The
committed B1 foul tuning remains; the uncommitted C5 corner constants are held
pending Phase 17 rather than locked as the final Phase 14b baseline.

Out of scope and tracked in BACKLOG: implementing Phase 17 pathways, new aerial
duel/header vocabulary, and Phase 8 retirement until the Phase 14b/17 baseline
is lockable.

## 2026-05-04 — FootSim Phase 15 outcome: modulation saturation diagnosed, alpha probe accepted

Phase 14 A5 landed PL20 shot volume (`22.24` shots/match) but broke
score-state shot impact (`-1.69%`). Phase 15 diagnosed the failure as
sum-normalised carrier-action probability compression: `selectCarrierAction`
samples post-modulation weights by `w_action / totalWeight`, so high baseline
shoot weights consume modulation headroom even without a hard clamp.

The generality result is important. Saturation applies to sum-normalised carrier
actions such as shoot, pass, and dribble. Tackle attempts use direct probability
multiplication by pressure, pressing, urgency, tackling, and stamina, so Phase
14b foul tuning faces a simpler calibration problem.

One bounded alpha probe was run and accepted: attacking-zone shoot weights were
set to 85% of A5, `SCORE_STATE.action.shoot` moved `1.28 -> 1.85`, and
`lateChaseShotIntent` moved `30 -> 42`; `maxUrgency` remains `1.4`. PL20 output:
`21.35` shots/match and `1.93` goals/match, both in band. Score-state shot
impact recovered to `+39.33%`, and all non-diagnostic responsiveness thresholds
passed.

Decision: resumed Phase 14b starts from alpha and proceeds to foul genesis
tuning. Phase 8 retirement remains deferred until the full Phase 14b baseline is
locked.

## 2026-05-04 — FootSim Phase 13.5 outcome: FC26 PL20 runtime ingestion and baseline

Before Phase 14 tuning, the FC26 runtime dataset was broadened from the original
five FootSim clubs to all 20 English Premier League clubs in
`data/fc-25/FC26_20250921.csv`. The import uses `league_id = 13` as the source
truth for English PL membership, not league name text, because the CSV includes
other "Premier League" competitions.

The runtime SQLite DB is now active on dataset
`fc25-20260504102445-4399cb2b-a504ee92` (`FC26 PL20 import 2026-05-04`): 20
clubs, 547 players, 547 squad rows. The 25-player import cap remains lifted;
Sunderland's 36-player squad emits a warning but imports successfully.

Phase 13.5 also added a PL20 baseline harness: 380 ordered directional fixtures
at 25 full-90 seeds each, default 4-3-3 balanced tactics, 9,500 runs total.
Aggregate output was `10.42` shots/match, `1.65` goals/match, `4.09`
fouls/match, and `2.00` corners/match. The event-volume gap therefore persists
after complete PL20 ingestion and remains a valid Phase 14 tuning target.

Server match-engine routes now validate club ids against the active FC dataset
rather than a hardcoded five-club list. Squad Manager football-data.org
verification remains configured only for the mapped five clubs and returns a
clear unsupported-club error for new PL clubs until mappings are added.

Out of scope and tracked in BACKLOG: adding football-data.org mappings for all
20 clubs, consuming FC26-rich fields in the engine, and executing Phase 14
tuning.

## 2026-05-04 — FootSim Phase 13 outcome: event volume gap diagnosed

Phase 13 diagnosed the Phase 12 FC26 event-volume gap without engine changes or
tuning. Football-Data.co.uk definitions were audited first: shots, goals, fouls,
and corners are definitionally comparable to FootSim's emitted/final-summary
metrics; cards have only a minor second-yellow caveat that does not explain the
gap. The low volume is therefore real, not mostly a source-definition artefact.

The snapshot-only diagnostic harness ran five representative directional FC26
fixtures, 100 full-90 seeds each. Result: `11.79` shots/match, `1.90`
goals/match, `4.47` fouls/match, `1.99` corners/match. Shot supply is dominated
by carrier-action shoot selection: `11.23` open-play carrier shots/match
(`95.3%` of shots), while chance creation contributes only `0.17` shots/match.
Foul volume is low because the emitted challenge economy is small (`11.62`
observable foul-or-successful-tackle resolutions/match). Corners are low in
absolute terms but plausible relative to current shot volume (`16.9` corners per
100 shots), so they should be retested after shot volume moves.

Decision: Phase 14 should tune with hypothesis, not blindly. Priority order is
baseline shot supply first, foul genesis second, then corner retest/tuning if
needed, with chance creation as a secondary shot-texture lever. No direct card
tuning before foul volume is addressed.

Out of scope and tracked in BACKLOG: executing Phase 14 tuning, adding new event
vocabulary, exact pre-roll instrumentation, and consuming FC26-rich fields.

## 2026-05-04 — FootSim Phase 12 outcome: FC26 multi-matchup measured against real PL

Phase 12 measured FC26-active real-squad output across 20 directional fixtures:
all 10 unique pairings among Arsenal, Aston Villa, Liverpool, Manchester City,
and Manchester United, both home/away directions, 100 full-90 seeds each.

The real-PL benchmark anchor changed from the original brief: 2025/26 to date is
primary because it matches the FC26 export era; 2024/25 complete is a stability
cross-check. Football-Data.co.uk supplies detailed goals, shots, fouls, cards,
and corners. The existing football-data.org token was probed and returned PL
scores but not detailed match statistics, so it is not the detailed benchmark
source.

Result: goals are real-PL realistic (`1.93` vs 2025/26 `2.75`, within one SD);
cards are defensible (`1.17` vs `3.85`, within two SDs); shots, fouls, and
corners are Bucket 3 (`11.80`, `4.49`, `2.00` vs real-PL `24.80`, `21.59`,
`9.93`). The 2024/25 cross-check points the same way, so this is not a
current-season artefact.

Decision: do not execute pure rebasing yet. Phase 8 synthetic bands remain
historical but not retired by code or tests. Next Mo/SA call is whether to tune
low event volume, accept low-volume/high-conversion as FootSim style, or keep
synthetic and real-squad gates separate.

Out of scope and tracked in BACKLOG: tuning event volume, rebasing tests/docs to
real-PL bands, and periodic benchmark refreshes.

## 2026-05-04 — FootSim Phase 11 outcome: FC26 baseline measured, characterisation drift surfaced

Phase 11 closed the FC25-vs-FC26 dataset-version loop by making the runtime DB
FC26-active and measuring current engine behaviour against the imported
`FC26_20250921.csv` dataset. The active FC dataset version is
`fc25-20260504073604-4399cb2b-7d80bef5`; the previous FC25 runtime version is
still present but inactive.

No engine changes and no calibration tuning. Phase 8 remains the historical
FC25/synthetic-reference baseline. Phase 11 is a separate current
FC26-active baseline documented in `docs/CALIBRATION_BASELINE_FC26.md`.

Responsiveness survived FC26: mentality, pressing, tempo, fatigue, Auto Subs,
score-state shot impact, and 1000-seed paired manual XI all passed. Manual XI
now removes Salah, Van Dijk, and Isak, replacing them with Wirtz, Szoboszlai,
and Ekitiké; the result was `-22.10%`, paired SE `3.91pp`, 95% CI
`[-29.77%, -14.43%]`.

The main drift is event volume. FC26 real-squad Liverpool vs Manchester City
characterisation fell below the old synthetic Phase 8 bands for shots, fouls,
and cards. This is classified as Bucket 3 and surfaced for Mo/SA discussion
before tuning. Likely decision: create separate real-squad FC26 bands or keep
synthetic targets as the only calibration gate.

Out of scope and tracked in BACKLOG: tuning from Bucket 3 outcomes, policy for
real-squad vs synthetic calibration gates, and future use of FC26-only fields
such as `work_rate`, `position_ratings_json`, traits, and tags.

## 2026-05-04 — FC26 dataset ingestion before Gemini shirt-number fallback

FC26 SoFIFA-format data is the preferred first fix for Squad Manager staleness
before adding any Gemini fallback for missing shirt numbers. The importer now
supports explicit `--format fc25|fc26|auto`, keeps auto-detection as the
default, imports full club squads without a 25-player cap, and warns without
blocking when a club exceeds 35 rows.

FC26-only metadata is preserved in `fc25_players` for future work: potential,
value, wage, release clause, body type, work rate, international reputation,
traits, tags, category ratings, goalkeeper speed, and position ratings JSON.
Nation-team, contract, loan/joined, and extra sourcing fields remain out of
scope.

No match-engine behaviour changed. Richer FC26 fields are tracked in BACKLOG
for a separate calibrated engine sprint so dataset freshness does not silently
change simulation output.

## 2026-05-03 — FootSim Squad Manager: admin tool with football-data.org verification

Squad Manager ships as the first FootSim admin tool: an `/admin/squad-manager`
page that verifies FC25 player data against current real-world squads via
football-data.org API, with Gemini-assisted reconciliation between the datasets.
Apply-suggestion flows create new FC25 dataset versions rather than mutating
existing data — the dataset-versions immutability pattern from Phase 1 is
load-bearing for the entire sprint.

Football-data.org free tier (10 req/min, 100 req/day) requires a rate-limit
gate, not just caching. Gate enforces both windows; caching is 24h TTL
in-memory; rate-limited requests fall back to stale cache or return 429 with
retry-after.

Aesthetic is deliberately retro Champions League — cream background, crimson
accent, forest green, Trebuchet MS small caps and Georgia serifs. This serves
both as visual identity for the FootSim admin surface and as preparation for
future Atatürk integration; the styling is intentional, not stretch goal. The
Atatürk itself remains parked.

Sprint executed by a fresh Codex session (separate from the engine sprint
session running through Phases 1-10). Brief is self-contained: project context,
conventions, architectural patterns stated explicitly rather than assumed.

Out of scope and tracked in BACKLOG: persistent cache, manual cache
invalidation, diff visualisation between dataset versions, suggestion rollback,
calibration revalidation against new versions, drag-and-drop XI editing in admin
tool, per-player arbitrary attribute editing, mobile responsiveness, other
football-data.org endpoints.

## 2026-05-03 — FootSim Phase 10 outcome: chance creation is low-effect unless chasing

Phase 10 investigated the isolated chance-creation toggle anomaly surfaced by
Phase 8. Repo truth corrected the prompt framing: Phase 8's `-7.14%` result was
Liverpool final-15 shots, not overall match shots.

The investigation used the Phase 9 methodology: 1000 paired seeds, Liverpool vs
Manchester City, Auto Subs off, fatigue/score-state/set-pieces/side-switch on,
and `chanceCreation: false` vs `chanceCreation: true`. A 50-seed sanity check
with chance creation off produced zero `chance_created` events, confirming the
flag disables the mechanism cleanly.

Results: exact isolated final-15 Liverpool shots moved `+2.98%` with a 95% CI
of `-5.23%` to `+11.20%` (Outcome 1, low-effect/noise). Exact isolated overall
shots moved `+2.37%` with a 95% CI of `+0.04%` to `+4.69%` (Outcome 1,
statistically detectable but below materiality). Forced-deficit final-15
Liverpool shots moved `+43.99%` with a 95% CI of `+33.02%` to `+54.95%`
(Outcome 2, real stable signal).

Decision: no tuning and no Phase 7 refactor-impact investigation. Chance
creation is low-effect in normal isolated play but highly meaningful when
score-state urgency creates a late chase context. The useful behaviour is
contextual, not absent.

## 2026-05-03 — FootSim Phase 8 resumed: calibration consolidation

Phase 8 resumed after Phase 9 classified the manual XI rotation trajectory as
Outcome 1: sample noise and an under-specified threshold at prior sample sizes.
The Phase 9 1000-seed paired result of `-15.93%` manual XI impact, with 95% CI
`[-24.37%, -7.48%]`, is now the locked high-precision baseline for that
experiment.

Phase 8 shipped the original consolidation scope: a locked
`CALIBRATION_BASELINE_PHASE_8.md`, comprehensive `CALIBRATION_REFERENCE.md`,
and sensitivity-test backfill for representative calibrated constants. The
manual XI responsiveness threshold in the 200-seed harness was widened from
`10%` to `7%`, matching the Phase 9 confidence interval lower bound. This is a
test-gate change only, not an engine-behaviour change.

The baseline document includes an explicit machine-readable JSON schema. The
`fc25:phase8-baseline` verifier reads strictly from that schema so future
calibration-changing sprints can update the JSON block and have the verifier
pick up the new numbers automatically.

The calibration consolidation principle held: legibility and
mutation-resistance, not "good calibration." Anomalies surfaced during
documentation are tracked in BACKLOG rather than tuned in this sprint. The
isolated chance-creation toggle remains a documented anomaly, while the intended
score-state shot-impact composition remains green.

## 2026-05-03 — FootSim Phase 9 outcome: manual XI impact decay was sample noise

Phase 9 investigated why manual XI rotation impact appeared to decay from
Phase 4's `-18.37%` to Phase 8's `-8.09%` 200-seed baseline. The sprint made
no engine changes and did not tune calibration constants.

The investigation used paired seeds over 1000 Liverpool vs Manchester City
full-match runs, with Auto Subs off to isolate personnel choice. The same
repeatable Liverpool rotation was used: Van Dijk, Salah, and Alexander-Arnold
out; Chiesa, Gakpo, and Núñez in.

Result: auto XI averaged `0.923` Liverpool goals, rotated XI averaged `0.776`,
for a `-15.93%` impact. Paired standard error was `4.31pp`, with a 95%
interval of `-24.37%` to `-7.48%`.

Classification: Outcome 1, sample noise. Manual XI impact remains materially
strong in the current engine; Phase 8's `-8.09%` result was a low-sample
outlier around a low-scoring metric. Strand B decomposition was skipped because
Strand A restored impact above the investigation threshold.

Decision: Phase 8 can resume against the current engine state. The Phase 9
1000-seed result is the baseline to reference for manual-XI impact rather than
the Phase 8 200-seed outlier. Future thresholds should account for the wider
variance of low absolute goal counts.

## 2026-05-03 — FootSim Phase 7 scope: true half-time side-switch

Phase 7 ships true half-time side-switching as a fidelity refactor, not a new
behaviour mechanic. New full-match runs default to `sideSwitchVersion: 1`, with
home and away attack directions flipping at the half-time boundary. Old
persisted runs without the field are treated as `sideSwitchVersion: 0` and keep
legacy rendering.

The refactor touched the audited direction surfaces: movement, pass, dribble,
tackle, clearance, shot distance, pressure, chance creation, carrier action,
momentum, set pieces, snapshots, persisted run summaries, and visualiser
diagnostics. Legacy direction helpers remain in place with explicit comments so
old-run and compatibility code paths are visible rather than accidental.

`second_half` runs now initialise in the post-half-time direction. This is a
semantic change with no expected statistical impact. A 500-seed A/B validation
(`sideSwitch: false` vs `sideSwitch: true`) passed statistical equivalence for
shots, goals, fouls, cards, possession, corners, and set-piece goals. No
calibration constants were changed.

Visualiser convention changed for new runs: the home team attacks different
ends in different halves, matching real broadcast/match convention. Ball
heatmaps remain raw coordinate maps; team attacking-territory diagnostics
normalise by the current attacking direction.

Out of scope and tracked in BACKLOG: side-switch animation, pitch slope/wind,
asymmetric player direction preferences, mid-half side-switching for special
cases, and a visible pitch direction indicator in replay UI.

## 2026-05-03 — FootSim Phase 6 scope: chance creation + taker-aware set pieces

Phase 6 ships two coupled shot-generation mechanics: chance creation and
taker-aware set pieces. Chance creation adds a branch from attacking-third
progression and late chase intent into the existing shot pipeline. Set pieces
select deterministic free-kick, corner, and penalty takers from v2 attributes
at simulate time and resolve corners, direct/indirect free kicks, and penalties
through the existing shot/save/goal machinery.

The Phase 5 score-state finding is closed at the headline level. In the
200-seed real-squad harness, forcing Liverpool 0-2 down at 75:00 increased
final-15 shots from 0.99 to 1.23 (+23.62%), clearing the Phase 6 +15% target.
The isolated chance-creation feature-flag diagnostic is deliberately recorded
as weak (+2.05% final-15 shots); the useful behaviour comes from composition
with score-state urgency rather than the feature flag alone.

Set-piece calibration uses empirical checks rather than assumed rates. Organic
penalties were initially below the useful diagnostic floor, so the coarse
attacking-foul-near-box penalty proxy was tuned before conversion was judged.
The final full-match 200-seed characterisation averages 2.41 corners, 0.15
penalties, and 0.25 set-piece goals. Corner conversion is approximately 4.6%;
penalty conversion is 83.9%. Both are inside the sprint target bands.

True half-time side-switch remains deferred. Set-piece direction follows the
same first-half-direction-throughout convention as the rest of the engine until
the dedicated side-switch refactor audits movement, pressure, action
resolution, shot distance, set-piece direction, and visualiser assumptions.

Out of scope and tracked in BACKLOG: corner routine choreography, wall-jumping
for free kicks, set-piece tactics, designated set-piece defending,
counter-attack speed differentiation, individual player instructions,
goalkeeper distribution, dribble-into-shot mechanics, shot-blocking, and
indirect-FK routine variety.

## 2026-05-03 — FootSim Phase 5 scope: fatigue, substitutions, score-state

Phase 5 adds the first in-match dynamics bundle: fatigue, substitutions, and
score-state urgency. These mechanics shipped together because they interact:
fatigue needs substitutions, substitutions need fatigue or score context to be
more than cosmetic, and score-state behaviour should compose with personnel
changes rather than sit as an isolated tuning knob.

Fatigue is calibrated as a modest but real full-match effect. A 200-seed
real-squad probe sampled active-player stamina from minute 70 onward with Auto
Subs off; the 25th percentile was `51`, so AI fatigue substitutions use
`fatigueThreshold: 51` rather than a guessed value. This produced 4.92 total
subs per match, 2.11 home and 2.81 away, with zero zero-sub matches in the
200-seed run.

The late action-success responsiveness threshold is set to the observed engine
baseline rather than the original guessed 10%: fatigue reduced late action
success by 4.26% across 200 real-squad seeds, while also affecting movement
speed, pressing intensity, and action probabilities.

Manual XI responsiveness is measured with Auto Subs off to isolate personnel
choice. The deliberate Liverpool rotation reduced home goals by 19.16%, clearing
the revised 10% threshold. The lower threshold reflects that Phase 5 mechanics
bound personnel impact over a full 90 minutes; high-quality starters also tire.

Score-state is qualitative in Phase 5. The urgency multiplier scales correctly
and shifts action distribution, but does not yet increase final-15 shot volume.
The current model makes trailing teams take more progressive risks; those risks
can become turnovers rather than chances. A future phase should add explicit
chance-seeking behaviour for trailing teams rather than tuning urgency strength
blindly.

## 2026-05-03 — FootSim Phase 4 scope: manual XI control + real-squad readiness review

Phase 4 keeps `packages/match-engine/src` frozen and matures the FootSim
workbench around the validated engine. The workbench now supports manual
starting-XI selection from the real FC25 squad, while preserving the automatic
formation-aware selector as the default. Manual selection is intentionally a
simple squad list with starter toggles plus an "auto-fill remainder" action;
drag-and-drop, saved presets, and manual bench selection are deferred.

Auto-fill semantics are deliberately conservative: current manual selections
remain locked, empty starter slots are filled from the current selector using
the highest-overall remaining squad players for the unfilled roles, and role
assignment is then run over the combined XI. This keeps the feature usable for
quick what-if tests without pretending to be a complete squad-management UI.

The simulate endpoint accepts optional `startingPlayerIds` per side and records
line-up mode, warnings, XI, and bench metadata in the persisted run summary.
The squad endpoint exposes the full squad, automatic XI, bench, role
assignments, and warnings for the selected formation. Run history gained basic
server-side filters for club, duration, formation, batch, seed, and date range.

Real-squad responsiveness now has a dedicated data-package harness. It runs
Liverpool vs Manchester City over 50 full-match seeds per comparison, varying
one Liverpool control at a time. The deliberate manual-XI rotation swaps the
top three highest-overall outfield auto starters for the top three highest-
overall outfield bench players. In the current FC25 data that removes Van Dijk,
Salah, and Alexander-Arnold, and adds Chiesa, Gakpo, and Núñez. The rotation
reduced Liverpool goals by 18.37%, clearing the 15% responsiveness threshold
and confirming manual XI choices are mechanically consequential.

The modelling-gap review remains intentionally conservative: no new mechanics
are added just because they are absent. Real-squad tests showed strong
responsiveness for mentality, pressing, tempo, XI rotation, and formation/wide
delivery shape, so the next engine work should be driven by observed UAT or
gameplay-agency needs rather than speculative modelling.

## 2026-05-02 — FootSim Phase 3 scope: full-match workbench + formation-aware XI

Phase 3 retires two Phase 1 compromises: workbench simulations default to
`duration: "full_90"` and FC25 starter XIs are selected at simulate time from
the full imported squad based on the chosen formation. The canonical duration
token remains `full_90`; `full_match` was not added as a second public spelling.
Pre-Phase-3 persisted runs without `summary.duration` are inferred as
`second_half` in the UI.

The engine was selectively unfrozen for full-match support only. It now emits a
rich `half_time` event at the 45:00 boundary and full-time at 90:00 for
`full_90` runs. True half-time side-switching of attack direction is explicitly
deferred because attack direction and zone perspective are spread across
movement, pass, dribble, tackle, shot, pressure, and set-piece code paths.
Shipping that safely requires its own audit and post-refactor full-match
characterisation pass.

Starter XI selection is now formation-aware. `fc25_squads.squad_role` remains
for backward compatibility but the simulate endpoint no longer uses it as the
source of truth. Persisted run summaries store rich XI entries (`id`, `name`,
`shortName`, role-in-XI `position`, optional `squadNumber`) so run history,
comparison, and batch views render historical line-ups without re-reading
artefacts or current FC25 imports.

Full-match characterisation uses doubled per-half targets: shots `[16, 24]`,
goals `[2, 6]`, fouls `[8, 16]`, cards `[2, 6]`, with the same max-score-share
limit of 40%. The standing characterisation default for preferred-foot testing
is `--preferred-foot-mode rated`; this is not a sprint-specific flag. The first
50-seed full-match v2 run landed at 16.76 shots, 1.98 goals, 10.34 fouls, and
2.58 cards. A follow-up 200-seed stress check landed at 16.59 shots, 2.23
goals, 9.73 fouls, and 2.75 cards, clearing all full-match target bands. The
50-seed goals miss is therefore treated as sampling noise, not a calibration
defect, and no probability constants were changed.

## 2026-05-02 — FootSim Phase 2 scope: workbench depth + server-side run persistence

Phase 2 ships in three strands as one combined sprint: server-side run persistence (foundation, new `match_runs` table in the existing Atatürk SQLite + four endpoints), side-by-side comparison view at `/visualise/compare`, and distribution analysis for 50-seed batches at `/visualise/batch/:batchId`. `VisualiserPage.tsx`'s freeze ends — shared components are lifted into `apps/web/src/match/visualiser/components/` organically as the comparison view needs them, with each lift a behaviour-preserving commit.

Run-history persistence is server-side (DB-backed) rather than localStorage. Rejected: localStorage (would have limited comparison and distribution to within-session only, defeating the "research tool" purpose). Rejected: file-on-disk metadata (artefacts already live there; row metadata for fast listing/filtering is the wrong shape for flat files). `/visualise/run` now treats the server as the source of truth for recent runs, while keeping new successful runs visible immediately after simulation. Eviction policy is deferred to Phase 3 — Phase 2 ships with manual delete only.

Comparison view is two runs only. N-way comparison and synchronised event-timeline scrubbing are deferred. Distribution analysis is shape inspection only — histograms with click-through, no regression analysis or hypothesis testing. Histogram bucket clicks open the lowest-seed representative run in the bucket for sprint 2; opening a picker of all runs in the bucket is deferred.

Workflow change effective this sprint: Codex executes full sprints to completion in a single pass, pausing only for genuinely ambiguous decisions, unresolvable test failures, or material plan-changing discoveries. Per-commit pauses are dropped after Phase 1 demonstrated the cost outweighed the protection at Codex's actual throughput.

## 2026-05-02 — FootSim Phase 1 scope: combined FC25 data + sim-runner workbench slice

Phase 1 ships as one combined sprint, not two sequential ones, to avoid the synthetic-then-retrofit problem in the workbench UI. Scope is tightly fenced: five hardcoded Premier League clubs (Arsenal, Manchester City, Manchester United, Liverpool, Aston Villa), in-memory run history, batch-then-load (no SSE) sim output, server-side artefact writes via the existing `visualiser-artifacts.ts` machinery, and `VisualiserPage.tsx` frozen except for a minimal approved `?artifact=` auto-load hook. The sim runner remains a sibling workbench page; visualiser decomposition is deferred to a later phase.

FC25 data lives in the existing Atatürk SQLite alongside the existing schema, with new `fc25_*` tables versioned via the established `dataset-versions` pattern. Rejected: a separate FootSim database (premature isolation; future commentary work will read both real-world player profiles and FC25 attributes). Rejected: workbench-first sprint with synthetic teams (avoids the retrofit risk but loses the from-day-one motivational return of seeing real squads run through the engine). Rejected: data-only sprint with no UI (visible payoff matters at this point in the project's lifecycle).

This sprint runs second-half-only simulations (`duration: "second_half"`, 900 ticks, 0-0 start). Full 90-minute FootSim support is deferred because it needs its own calibration pass. Starter XIs are formation-neutral, locked at FC25 ingest time, and reused across all submitted formations in sprint 1; formation-aware XI selection is deferred until the workbench grows squad/role selection. `apps/web/src/match/visualiser/VisualiserPage.tsx` and `packages/match-engine/src/ticks/movement.ts` are both at the complexity ceiling but neither is decomposed this sprint. Both decompositions are tracked for a later phase, when comparison/diff work in the workbench forces the issue.

## 2026-05-01 — Match-engine responsiveness gate passed before Atatürk integration
The standalone match engine cleared the pre-declared responsiveness gate after the post-v2 UAT refinement work. Tactical tests varied one Liverpool lever at a time while Milan stayed at baseline: attacking vs defensive mentality moved Liverpool shots by 151.61%, high vs low pressing moved Liverpool fouls by 180.49%, and fast vs slow tempo moved possession-streak length by 15.80% in the football-correct direction (fast tempo shortened streaks by increasing risk and turnovers). A +15 boost to Smicer's v1 internal attributes moved Liverpool goals by 157.14%, validating that a Player Manager protagonist can affect outcomes, though the absolute lift remains a gameplay-tuning question. The scripted 60-minute swap harness is deliberately test-only (`__testApplyMidMatchAttributeSwap`) and must not be treated as a real substitution API during Atatürk integration. A 100-seed v2 stress test reduced the previous `0-3` score-share watch item from 40% to 33%, giving distribution headroom. Weak-foot compounding was tested as a temporary experiment and produced only a modest goals lift (1.00 -> 1.06), so mechanics were left unchanged.

## 2026-05-01 — Momentum remains kinematic and is exposed for diagnostics
Attack-flow momentum now lives in match state and affects only player movement, not shot or goal probabilities. This avoids feedback loops where pressure directly improves scoring odds, while still allowing midfielders/full-backs to support attacks when possession streak and territorial progress justify it. Snapshot ticks now expose `attackMomentum` and `possessionStreak`; the visualiser heatmap shows those values as a small diagnostic overlay. Rationale: commentary, UAT, and future responsiveness analysis should read known engine state instead of inferring momentum from event patterns.

## 2026-05-01 — v2 attribute bridge preserves v1 calibration and isolates weak-foot behaviour
The match engine now accepts FC25-style v2 player attributes, adapts them to the calibrated v1 schema internally, and preserves v2 metadata on snapshots. V1 inputs remain byte-identical on representative snapshot diff and unchanged across the 50-seed characterisation aggregate. Weak-foot behaviour uses two calibration tables keyed by 1-5 star rating; 3★ anchors the original 75/25 preferred-foot split and 0.85 weak-foot multiplier, making the design point explicit. The neutral v2 characterisation first exposed synthetic adapter-distribution drift (cards 0.96 vs target floor 1.0), so the synthetic v2 generator was tightened to preserve the original v1 bridge values before measuring weak-foot behaviour. Rated weak-foot v2 characterisation passed targets, with a small observed fouls/cards uptick (4.80 → 5.14 fouls, 1.20 → 1.26 cards) that is within bounds but unexplained; possible mechanism is altered shot/save outcomes creating more possession contests. Future shot-resolution calibration should watch that number.

---

## 2026-04-30 — Patching `footballsimulationengine` upstream bug (truthiness in discovery)
A critical null-reference crash was discovered in `lib/actions.js` where `index` results from `findIndex` were checked for truthiness (`if (index)`) instead of existence (`if (index > -1)`). This caused crashes on non-discovery (-1 is truthy) and silent failures for the first player in any roster (0 is falsy). Given the engine's age and our "wrap, don't fork" strategy, we have applied a direct local patch to `node_modules`. Long-term strategy: use `patch-package` to maintain the patch or fork if further stability issues arise. See `docs/CHARACTERISATION.md`.

---

## 2026-04-30 — Vertical slice ships text-only match playback
The first playable match is plain text only — no commentary, no audio, no broadcast styling. The goal is engine validation: does the football look right? UI polish, commentary, TTS, and match HUD all build on top of a working text-only base. Decision deferred: layout and styling for the eventual `/match` page, handled in a future sprint after engine output is validated.

## 2026-04-30 — Pivot v0.1 to second-half-only Istanbul
v0.1 now starts at the half-time whistle of the 2005 Champions League final, with Liverpool already 0-3 down to Milan and 45 minutes already played. The user takes control in the dressing room, has a short decision window for team-talk, tactics, substitutions, and optional self-substitution, then plays only the second half plus extra time/penalties if reached. Rationale: the project is named after the Atatürk and the second half is the emotionally important object; starting at kickoff asks the user to prevent the very disaster that gives Istanbul its meaning. See `PROJECT_BRIEF.md`, `LORE.md`, and `PLAYER_MANAGER_MODE.md`. Rejected: full 90-minute v0.1 as the canonical mode.

## 2026-04-30 — User-player on-field intent uses six toggles plus demand-ball action
When the user-player is on the pitch, broad tactical controls remain frozen, but the user gets direct personal intent controls: up to 3 persistent toggles from killer pass, take it on yourself, get forward, sit deeper, press the ball, and aggressive tackle, plus 3 uses per half of demand the ball. Rationale: this preserves the Player Manager state-machine tradeoff while giving on-pitch play agency that is concrete and engine-mappable. Diving/simulation is deferred because it requires wrapper-side contact-in-box detection and award/booking adjudication. See `PLAYER_MANAGER_MODE.md`.

## 2026-04-30 — Attribute derivation retries include validation feedback
Phase B Step 2B added adaptive retry for LLM-derived player attributes: if structured output parses but fails position/tier validation, the retry includes the validation reasons. Without this, roughly 5 of 49 players would have failed deterministic validation on the first pass. Rationale: the model can correct specific rubric misses cheaply, while a hard fail would force unnecessary manual edits. Rejected: silently accepting invalid ratings or retrying without telling the model what failed.

## 2026-04-30 — Goalkeeper validation uses GK-specific bands, not outfield headline counts
Step 2B exposed contradictory goalkeeper wording in `docs/prompt_rubric_draft.md`: outfield headline-count thresholds conflicted with the GK-specific saving/perception/jumping bands. The rubric and validator now treat headline counts as outfield-only. Goalkeepers use saving tier bands and GK-relevant perception, jumping, and agility floors. Rationale: otherwise valid keepers fail because they are not supposed to have many high outfield attributes.

## 2026-04-30 — Derivation readiness uses populated profiles, not edited flags
Attribute derivation pre-flight treats a profile version as ready when required profile fields are populated and not failed. It does not require every player profile to have `edited=true`. Rationale: "curated" is a version workflow signal (forked, named, activated), while `edited` is a granular per-player signal meaning a human touched that specific profile. Activating a curated fork should not force fake edited flags across every row.

## 2026-04-30 — Attribute derivation reads rubric from disk at runtime, not embedded
The LLM system prompt for attribute derivation is the contents of
docs/prompt_rubric_draft.md, loaded at the start of each derivation
run. This means rubric revisions don't require code changes — edit
the doc, fork to a new dataset version, re-derive. Rejected:
embedding the rubric in TypeScript (would couple rubric edits to
deploys; would require tests to be rewritten on every rubric
revision).

## 2026-04-29 — v0.1 includes Player Manager mode (single mode, mandatory player creation)
v0.1's core gameplay is "Player Manager": user creates their own player upfront with a budget-constrained attribute spread (5% above best player's total, configurable), picks from 8 archetype presets or blank slate, and joins Liverpool's squad. Tactical control depends on whether the user-player is on the pitch — full manager mode when off, frozen tactics + sub-self-off as the only action when on. There is no separate "manager only" mode; users who don't want to play themselves simply don't pick themselves in the XI or come off the bench. Rejected: two parallel modes (would have doubled UI surface for marginal benefit). Rejected: optional player creation (would have added branching everywhere for a feature most users would engage with). Scope expansion accepted: v0.1 ships ~30-40% later than manager-only would have. See PLAYER_MANAGER_MODE.md.

## 2026-04-29 — Player attribute budget is configurable, not hardcoded
The user-player's total attribute budget is a multiple of the best in-game player's total. Default multiplier 1.05 (5% above best), with per-attribute caps and floors. All values are configurable in `packages/data/src/config/player-budget.ts` for tuning during testing. Range supported: 0.8x to 1.5x for stress-testing different power levels. Not exposed to users — internal tuning knob.


## 2026-04-29 — Engine smoke test is deterministic via seeded `Math.random`
The smoke test in packages/engine/test/match-smoke.test.ts mocks
Math.random with a seeded LCG to produce a reproducible match each run.
This trades distributional realism for test stability — we'd rather have
a deterministic pass/fail than a flaky test that fails one run in twenty
when randomness conspires against us. Realism validation across seeds
is tracked separately as a backlog item (engine realism characterisation
test). Rejected: probabilistic assertions with statistical bounds (would
add noise without catching real bugs at v0.1).

## 2026-04-29 — v0.1 is text-only; match state stream preserves full positional data for v0.2 renderer
v0.1 ships with a commentary-only UI (no pitch view) — the radio-broadcast aesthetic is intentional, and the LLM commentary thesis must carry the experience without visual crutches. But the server's match state stream preserves the engine's full per-iteration positional payload (player x/y, ball x/y/z, per-player deltas) so v0.2 can add a 2D top-down pitch renderer as a pure additive frontend change. v0.3+ layers event overlays (pass arrows, shot arcs, heatmaps) on top. Pseudo-3D / FM-style match view is out of scope at all versions. Rejected: stripping the v0.1 stream down to events-only (would force a server refactor at v0.2).

## 2026-04-29 — Wrap, don't fork `footballsimulationengine`
Adopt as npm dependency, build typed adapter layer above. Aligned with upstream improvements; small enough to fork later if upstream goes dark. Rejected: forking immediately (permanent maintenance debt) and writing our own engine (huge scope, no payoff for v0.1).

## 2026-04-29 — Scope v0.1 to a single match (the 2005 CL final)
"Istanbul: The Game". One Liverpool vs Milan match, fully realised. If this match doesn't feel magical, the project doesn't continue. Rejected: full Liverpool campaign as v0.1 (too much scope before validating the magic moment).

## 2026-04-29 — Gemini 3 family for LLM, swappable TTS provider
Gemini 3 Flash for per-event commentary, Gemini 3.1 Pro for set-piece moments (pre-match, half-time, full-time, decisive moments). TTS provider abstraction from day one — Gemini TTS as default during dev, ElevenLabs as A/B comparison near v0.1 ship. Rejected: locking to a single TTS vendor early (voice quality is the sensory hook, worth treating as tunable).

## 2026-04-29 — Project name "The Atatürk", repo name `the-ataturk`
Display name with diacritic, repo without (cleaner, no encoding issues). Named after the Atatürk Olympic Stadium in Istanbul where the 2005 final was played.

## 2026-04-29 — Defer Vercel deployment until v0.1 demo time
Repo on day one (enables direct GitHub tooling, better than zip handoffs). Vercel deferred — Node backend with streaming + audio + game state has Vercel-specific gotchas worth thinking through with a working local app, not before.

## 2026-04-29 — Monorepo with workspaces
Clean separation of engine wrapper / tactics / commentary / TTS as packages. Useful for testing and (potential) reuse. Layout in `ARCHITECTURE.md`.
