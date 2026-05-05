# Session Status — 2026-05-05 08:36 SAST

## Context

This session resumed from Phase 17 after Phase 16 diagnosed the corner-volume
gap as a missing-pathway problem. B1 foul tuning was already committed, and the
active runtime DB was already FC26 PL20.

## What Landed

- Added PL20 diagnostics for save counts, corner reasons, wide-delivery counts,
  and blocked-delivery corner contribution.
- Added save/parry-wide corners in `shot.ts`.
- Added blocked wide-delivery corners in `pass.ts`.
- Rebased `CALIBRATION_TARGETS` to real-PL half-match equivalents.
- Locked `docs/CALIBRATION_BASELINE_PHASE_14.md` as the active baseline.
- Retired Phase 8 as the active calibration anchor while preserving its
  historical FC25/synthetic numbers.

## Final Validation

Command:

```bash
pnpm --filter @the-ataturk/data fc25:phase14-validation -- --output packages/match-engine/artifacts/phase17-validation.json --pl20-seeds 50 --responsiveness-seeds 200 --manual-xi-seeds 1000 --side-switch-seeds 200
```

Result: PASS.

PL20 event volume:

- Shots: `22.67` in `[19.4, 30.2]`
- Goals: `2.19` in `[1.16, 4.34]`
- Fouls: `17.47` in `[16.6, 26.6]`
- Cards: `5.10` in `[1.83, 5.87]`
- Corners: `7.01` in `[6.7, 13.2]`
- Set-piece goal share: `10.79%`

Responsiveness:

- Mentality: `+86.30%`, PASS
- Pressing: `+197.95%`, PASS
- Tempo: `-17.32%`, PASS
- Fatigue: `-4.49%`, PASS
- Auto Subs: `6.26` subs/match, PASS
- Score-state shot impact: `+15.76%`, PASS against Phase 14b `+10%` gate
- Manual XI: `-31.84%`, 95% CI `[-38.12%, -25.56%]`, PASS
- Side-switch spot check: PASS

## Probe Notes

Save-wide probe grid:

- P1: `6.42` corners, saved-wide `0.21`/match
- P2: `6.51` corners, saved-wide `0.30`/match
- P3: `6.62` corners, saved-wide `0.40`/match

Save supply was only `~1.49` saves/match, so save-wide was safe but
insufficient alone.

Blocked-delivery probes:

- C1: `6.88` corners, blocked-delivery `0.23`/match
- C2: `7.01` corners, blocked-delivery `0.34`/match

C2 was accepted because it passed with margin and did not breach shots, goals,
fouls, cards, or set-piece goal-share guardrails.

## Current Baseline

Active calibration baseline: `docs/CALIBRATION_BASELINE_PHASE_14.md`.

Historical baseline: `docs/CALIBRATION_BASELINE_PHASE_8.md`.

Runtime DB remains FC26 PL20 active. Phase 8 numbers are not reproducible
against this DB without rolling back to the historical FC25-active dataset.

## Open Follow-Ups

- Chance-creation tuning remains deferred.
- Aerial/header, byline-duel, and goal-line emergency block corner pathways are
  fidelity candidates, not calibration blockers.
- Future calibration tightening to 0.5 SD is optional.
- Refresh real-PL benchmarks after the 2025/26 season completes.

## Commits This Session

- `79e3741 feat(data): add phase17 corner-path diagnostics`
- `2248a52 feat(match-engine): add save-wide corner pathway`
- `f607af0 feat(match-engine): add blocked delivery corner pathway`
- `c067a39 test(match-engine): rebase calibration targets to phase14b`
- final docs commit pending at time of writing
