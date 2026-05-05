# FootSim UAT Research Report UAT_RESEARCH_20260505-172600-SAST

Started: 2026-05-05T15:26:00.670Z
Finished: 2026-05-05T15:26:22.504Z
State: PASS
Evidence JSON: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST.json
Gemini report: not requested

## Run Configuration

- Batch size: 50
- AI interpretation: off (--no-ai)
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
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/dashboard.png

### Run And Replay

State: PASS

- Created run 4cf1a642-5f94-4fbc-b16a-426ae4a973c5 with seed 260501.
- Replay loaded artefact match-engine-20260505152603-liv-mci-seed-260501-d5ccef84.json.
- Score 2-1; shots 19-16; fouls 8-12.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/replay.png

### Tactical Contrast

State: PASS

- Compared same teams and seed 260502.
- Low pressing/slow tempo fouls: 10.
- High pressing/fast tempo fouls: 22.
- Assertion is direction-only; magnitude is retained as context.

### Formation Compare

State: PASS

- Compared run 4cf1a642-5f94-4fbc-b16a-426ae4a973c5 with run b842875d-98e4-46b3-b0a0-635d1daaf6ef.
- Home XI changed: yes.
- Compare page loaded the line-up and summary surfaces.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/compare.png

### Batch Distribution

State: PASS

- Created 50 runs in batch 7726eed7-abef-43b3-bb3c-d5ca219f0e9c.
- Mean goals: 2.74.
- Mean shots: 24.90.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/batch.png

### Squad Manager Verify Apply Activate

State: PASS

- Review mode defaulted on and guarded apply: yes.
- Applied 2 low-risk fixture suggestions.
- Created inactive dataset version fc25-squad-manager-low-20260505152622-376defb0.
- Activated fc25-squad-manager-low-20260505152622-376defb0 via explicit UI action.
- Audit actor squad-manager-ui; risk low.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/squad-manager-review.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/squad-manager-apply-modal.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-172600-SAST_assets/squad-manager-applied.png

## Direction-Only Assertions

- same-seed high pressing and fast tempo total fouls: PASS (10 -> 22, delta 12, 120.00%)

## Admin Apply Validation

- Source dataset: uat-fc26-pl20
- New inactive dataset: fc25-squad-manager-low-20260505152622-376defb0
- Activated dataset: fc25-squad-manager-low-20260505152622-376defb0
- Applied suggestions: uat-low-name-212831, uat-low-nationality-203376
- Audit actor: squad-manager-ui
- Audit risk level: low

