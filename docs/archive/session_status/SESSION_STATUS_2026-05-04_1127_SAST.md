# Session Status — 2026-05-04 11:27 SAST

## Where The Project Stands

FootSim is running on the FC26-active runtime dataset
`fc25-20260504073604-4399cb2b-7d80bef5`. Phase 12 showed that the real-squad
multi-matchup baseline has realistic goals but materially low shots, fouls, and
corners versus current real-PL benchmarks.

Phase 13 completed the diagnostic layer for that gap. No engine behaviour
changed and no constants were tuned. The conclusion is now specific enough for
Phase 14: tune baseline shot supply and foul genesis first, retest corners after
shot volume moves, and keep goals as the main guardrail.

## Repo State

- Branch: `main`.
- Latest implementation commits before the docs commit:
  - `1d73065 feat(data): add phase 13 event-volume diagnostic harness`
  - `a9a8900 test(data): cover phase 13 diagnostic helpers`
- Runtime DB: FC26-active and intentionally persistent across sessions.
- Dev stack URLs: no dev servers are required or running for this sprint.
- Raw report: `packages/match-engine/artifacts/phase13-event-volume-diagnostics.json`
  (gitignored).

## What Landed

- Added `pnpm --filter @the-ataturk/data fc25:phase13-event-volume`.
- Added a snapshot-only diagnostic harness for five representative FC26
  directional fixtures x 100 seeds.
- Added helper tests for definition audit, event classification, and diagnostic
  ratio calculations.
- Added `docs/PHASE_13_INVESTIGATION_FINDINGS.md` as the Phase 14 tuning input.

## Key Findings

- Definition audit: Football-Data.co.uk shots, goals, fouls, and corners are
  comparable to FootSim's emitted/final-summary metrics. Cards have only a minor
  second-yellow caveat. The event-volume gap is real, not mostly definitional.
- Aggregate over 500 full-90 diagnostic runs: shots `11.79`, goals `1.90`,
  fouls `4.47`, cards `1.24`, corners `1.99`.
- Shot supply is overwhelmingly carrier-action driven: `11.23` open-play
  carrier shots/match, `95.3%` of all shots.
- Chance creation emits `4.69` chances/match but only `0.17` shots/match. It is
  not the primary ordinary-match shot-volume lever.
- Fouls are low because observable challenge volume is low: `11.62`
  foul-or-successful-tackle resolutions/match.
- Corners are low in absolute terms but plausible relative to current shots:
  `16.9` corners per 100 shots.

## Queued Next

1. Phase 14 event-volume tuning sprint:
   - carrier-action shot supply first
   - tackle-attempt/foul genesis second
   - retest corners after shot volume changes
   - direct card tuning only if foul tuning leaves cards out of range
2. UAT remains overdue once event-volume calibration policy is stable.
3. Commentary foundation remains a deferred candidate after calibration/tuning
   decisions settle.

## Operating Notes

- Do not treat Phase 13 as a tuning result. It is a diagnostic and priority map.
- Any Phase 14 shot-volume tune must protect goals, because goals are already
  close to real-PL realistic.
- The diagnostic harness is intentionally snapshot-only. Exact raw missed tackle
  attempts or failed corner-opportunity rolls would require engine-source
  instrumentation and should be approved explicitly before adding.
- Runtime DB remains FC26-active. Phase 8 FC25/synthetic numbers are historical
  and are not reproducible against this DB without rolling back active dataset
  state.

## Verification

- `pnpm --filter @the-ataturk/data typecheck` — passed during implementation.
- `pnpm --filter @the-ataturk/data test -- test/fc25/phase13EventVolumeDiagnostics.test.ts`
  — passed.
- Full `pnpm lint`, `pnpm typecheck`, and `pnpm test` — passed before final
  close-out.
