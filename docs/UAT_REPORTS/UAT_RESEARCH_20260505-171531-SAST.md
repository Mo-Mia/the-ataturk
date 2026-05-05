# FootSim UAT Research Report UAT_RESEARCH_20260505-171531-SAST

Started: 2026-05-05T15:15:31.750Z
Finished: 2026-05-05T15:15:41.729Z
State: PASS
Evidence JSON: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST.json
Gemini report: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_GEMINI.md

## Run Configuration

- Batch size: 5
- AI interpretation: on
- Admin verification: fixture
- Temp retention: cleaned on success/failure

## Summary

- Passed: 6
- Failed: 0
- Warnings: 0

## Scenarios

### Dashboard Active Dataset

State: PASS

- Active dataset selector reported uat-fc26-pl20.
- PL20 fixture exposed 20 clubs and 547 players.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/dashboard.png

### Run And Replay

State: PASS

- Created run cec71bbd-6847-42f3-af0b-e14804dcd470 with seed 260501.
- Replay loaded artefact match-engine-20260505151534-liv-mci-seed-260501-d5ccef84.json.
- Score 2-1; shots 19-16; fouls 8-12.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/replay.png

### Tactical Contrast

State: PASS

- Compared same teams and seed 260502.
- Low pressing/slow tempo fouls: 10.
- High pressing/fast tempo fouls: 22.
- Assertion is direction-only; magnitude is retained as context.

### Formation Compare

State: PASS

- Compared run cec71bbd-6847-42f3-af0b-e14804dcd470 with run 493489c1-aa09-4df6-ab8f-bc9a1b999af3.
- Home XI changed: yes.
- Compare page loaded the line-up and summary surfaces.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/compare.png

### Batch Distribution

State: PASS

- Created 5 runs in batch 43e3bf8d-e1fd-46e7-ac9b-7287a6b48b70.
- Mean goals: 2.00.
- Mean shots: 24.40.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/batch.png

### Squad Manager Verify Apply Activate

State: PASS

- Review mode defaulted on and guarded apply: yes.
- Applied 2 low-risk fixture suggestions.
- Created inactive dataset version fc25-squad-manager-low-20260505151541-1047c7a3.
- Activated fc25-squad-manager-low-20260505151541-1047c7a3 via explicit UI action.
- Audit actor squad-manager-ui; risk low.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/squad-manager-review.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/squad-manager-apply-modal.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-171531-SAST_assets/squad-manager-applied.png

## Direction-Only Assertions

- same-seed high pressing and fast tempo total fouls: PASS (10 -> 22, delta 12, 120.00%)

## Admin Apply Validation

- Source dataset: uat-fc26-pl20
- New inactive dataset: fc25-squad-manager-low-20260505151541-1047c7a3
- Activated dataset: fc25-squad-manager-low-20260505151541-1047c7a3
- Applied suggestions: uat-low-name-212831, uat-low-nationality-203376
- Audit actor: squad-manager-ui
- Audit risk level: low

