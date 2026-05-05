# Session Status — 2026-05-04 17:21 SAST

## Where The Project Stands

FootSim is in the middle of Phase 14 event-volume tuning against the FC26 PL20
runtime dataset. Phase 14 Strand A initially landed shot volume via A5 but broke
score-state shot responsiveness. Phase 15 investigated that blocker and accepted
an alpha configuration that restores score-state responsiveness while keeping
shots/goals in real-PL bands.

The active runtime DB remains FC26 PL20:
`fc25-20260504102445-4399cb2b-a504ee92`. Phase 8 remains historical; Phase 8
retirement is deferred until Phase 14b locks the full tuned baseline.

## Repo State

- Branch: `main`
- Last code commit before docs: `d12a0da`
- Worktree at time of writing: docs pending for final Phase 15 commit
- Dev stack: no dev server required for this sprint

## What Landed

- `53a5beb feat(data): add phase15 modulation diagnostics`
  - Added headroom calculator and CLI.
  - Added shot-composition diagnostics to PL20 reports.
  - Added `fromZone` to shot events for diagnostic attribution.
- `d12a0da feat(match-engine): apply alpha score-state headroom probe`
  - Applied alpha constants: attacking-zone shoot weights at 85% of A5,
    score-state shoot action `1.85`, late-chase shot intent `42`.
  - Rebased deterministic tests affected by the new shot-volume constants.

## Measurements

Phase 14 A5 final PL20 reference:

- Shots `22.24`, goals `2.03`
- Score-state shot impact failed: `-1.69%`

Phase 15 alpha PL20:

- Shots `21.35` in `[19.4, 30.2]` — pass, low-band
- Goals `1.93` in `[1.16, 4.34]` — pass
- Fouls `4.12`, cards `1.01`, corners `2.80` — still Phase 14b targets
- Score-state shot impact `+39.33%` — pass
- Mentality `+81.90%`, pressing `+220.67%`, tempo `-18.36%`, fatigue
  `-3.31%`, Auto Subs activation pass, manual XI `-19.69%`

## Key Finding

The saturation issue is not universal. Carrier actions are sum-normalised:
`p(action) = w_action / totalWeight`, so high baseline shoot weights compress
score-state and mentality headroom. Tackle attempts use direct probability
multiplication, so Phase 14b foul tuning should be simpler and should not need
the same architectural workaround.

## Queued Next

1. Resume Phase 14b at Strand B foul genesis tuning from the alpha configuration.
2. Protect alpha's low-band shot floor while raising fouls/cards.
3. Retest corners after shots and fouls stabilise.
4. Retire Phase 8 only after Phase 14b locks the final real-PL baseline.

## Verification So Far

- `pnpm --filter @the-ataturk/data test -- phase15ModulationDiagnostics.test.ts fc26Pl20Baseline.test.ts` passed.
- `pnpm --filter @the-ataturk/data typecheck` passed.
- `pnpm --filter @the-ataturk/match-engine typecheck` passed.
- `pnpm --filter @the-ataturk/match-engine test` passed.

Full repo `pnpm lint`, `pnpm typecheck`, and `pnpm test` still need to run after
the docs commit is staged.
