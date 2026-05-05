# Session Status — 2026-05-04 23:23 SAST

## Where The Project Stands

FootSim is in the middle of Phase 14b/16 calibration work. The engine has moved
from the old low-volume PL20 baseline to realistic shots, goals, fouls, and
cards. B1 foul tuning is committed. Corner generation remains the only primary
event-volume metric not cleanly in band.

Phase 16 was an investigation sprint. It made no engine changes. It diagnosed
why Phase 14b corner tuning saturated just below the real-PL floor and produced
a Phase 17 pathway recommendation.

## Repo State

- Branch: `main`
- Last commit before Phase 16 docs: `c2ef557 feat(match-engine): tune foul genesis for phase14b`
- Intentional uncommitted file remains: `packages/match-engine/src/calibration/probabilities.ts`
  with C5 corner constants.
- Phase 16 docs are committed separately; the engine file is not part of that
  commit.

## What Landed

- `docs/PHASE_16_INVESTIGATION_FINDINGS.md`: full corner pathway audit,
  real-football taxonomy, gap analysis, and Phase 17 recommendation matrix.
- `docs/DECISIONS.md`: Phase 16 outcome entry.
- `docs/BACKLOG.md`: Phase 17 implementation item, Phase 14b baseline-lock
  follow-up, score-state lever-authority follow-up.
- `docs/MATCH_ENGINE_MODEL_GAPS.md`: corner-generation pathway gap added.
- `docs/CALIBRATION_REFERENCE.md`: defensive-clearance corner saturation note.

## Key Findings

- FootSim currently awards corners only from deflected missed shots and
  defensive clearances.
- `defensiveClearanceCorner` saturates once tuned to `1.0` or higher. C4 and C5
  are functionally equivalent on that branch.
- Missing real-football pathways include keeper saves/parries wide, blocked wide
  deliveries, byline tackle deflections, defensive headers behind, and emergency
  goal-line blocks.
- Phase 17 should implement new corner-eligible pathways rather than raising
  existing probabilities again.

## Next

Recommended next sprint: Phase 17 corner-generation implementation.

Priority order:

1. Add save/parry-wide corners.
2. Add blocked wide-delivery corners if needed.
3. Validate PL20 event volume and full responsiveness.
4. Then resume Phase 14b baseline lock and Phase 8 retirement.

## Operating Notes

- The B1 foul tuning commit is already in `main`; do not treat it as pending.
- C5 corner constants are intentionally uncommitted. Phase 17 should decide
  whether to retain them as a starting point or lower them after adding new
  pathways.
- Do not run `git add -A` while this paused engine file remains uncommitted.
