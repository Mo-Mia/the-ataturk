# Session Status — 2026-05-04 09:52 SAST

## Where The Project Stands

FootSim now has two calibration references. Phase 8 remains the historical
FC25/synthetic-reference baseline. Phase 11 adds a current FC26-active runtime
baseline against the imported `FC26_20250921.csv` dataset.

The runtime SQLite DB is now active on FC26 going forward. Phase 8 numbers are
no longer reproducible against this default DB without reactivating an FC25
dataset version. That is intentional and documented so future sessions do not
compare FC25 baseline numbers against FC26 runtime output accidentally.

## Repo State

- Branch: `main`.
- Measurement-time commits: `8c74b7e`, `1afce7f`, `a98aec4`.
- Active FC dataset: `fc25-20260504073604-4399cb2b-7d80bef5`.
- Raw artefact:
  `packages/match-engine/artifacts/calibration-baseline-fc26.json`
  (gitignored).

## What Landed

- Added `pnpm --filter @the-ataturk/data fc25:fc26-baseline`.
- Added preflight checks for FC26-active runtime DB, metadata columns, squad
  counts, and lineup sanity.
- Imported FC26 into the default runtime DB after applying migrations.
- Measured 50-seed sanity, 200-seed characterisation, 200-seed responsiveness,
  and 1000-seed paired manual XI.
- Documented the FC26 baseline in `docs/CALIBRATION_BASELINE_FC26.md`.

## Results

- Sanity: PASS. All five clubs form valid XIs; no lineup warnings.
- Responsiveness: PASS for mentality, pressing, tempo, fatigue, Auto Subs,
  score-state shot impact, and manual XI.
- Manual XI: Salah, Van Dijk, and Isak out; Wirtz, Szoboszlai, and Ekitiké in.
  Result `-22.10%`, paired SE `3.91pp`, 95% CI `[-29.77%, -14.43%]`.
- Characterisation: Bucket 3 for event volume. FC26 real-squad Liverpool vs
  Manchester City is below old synthetic Phase 8 target bands for shots, fouls,
  and cards.

Synthesis: Bucket 1 metrics `7`, Bucket 2 metrics `3`, Bucket 3 metrics `7`.
Recommendation is Mo/SA discussion before tuning, specifically on whether
real-squad FC26 characterisation should get separate bands or remain diagnostic
beside synthetic calibration gates.

## Open Follow-Ups

- Decide FC26 real-squad characterisation policy.
- Preserve standard errors in future locked calibration baselines.
- Future engine sprints may use FC26 `position_ratings_json`, `work_rate`, body
  data, traits, and tags, but this sprint made no engine behaviour changes.

## Verification

Completed during sprint:

- `pnpm --filter @the-ataturk/data test -- test/fc25/fc26CalibrationBaseline.test.ts`
- `pnpm --filter @the-ataturk/data typecheck`

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
