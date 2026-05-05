# FootSim UAT Research Report UAT_RESEARCH_20260505-151352-SAST

Started: 2026-05-05T13:13:52.907Z
Finished: 2026-05-05T13:14:03.020Z
State: PASS
Evidence JSON: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST.json
Gemini report: not requested

## Run Configuration

- Batch size: 2
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
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/dashboard.png

### Run And Replay

State: PASS

- Created run 19a38e53-f2b6-40ba-81ba-0d801dddb1ce with seed 260501.
- Replay loaded artefact match-engine-20260505131355-liv-mci-seed-260501-d5ccef84.json.
- Score 2-1; shots 19-16; fouls 8-12.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/replay.png

### Tactical Contrast

State: PASS

- Compared same teams and seed 260502.
- Low pressing/slow tempo fouls: 10.
- High pressing/fast tempo fouls: 22.
- Assertion is direction-only; magnitude is retained as context.

### Formation Compare

State: PASS

- Compared run 19a38e53-f2b6-40ba-81ba-0d801dddb1ce with run e11b3f5a-1167-4302-b4fa-699a9bfa3e56.
- Home XI changed: yes.
- Compare page loaded the line-up and summary surfaces.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/compare.png

### Batch Distribution

State: PASS

- Created 2 runs in batch af0a41b2-b917-4589-a81c-4ce648707c19.
- Mean goals: 1.00.
- Mean shots: 20.50.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/batch.png

### Squad Manager Verify Apply Activate

State: PASS

- Review mode defaulted on and guarded apply: yes.
- Applied 2 low-risk fixture suggestions.
- Created inactive dataset version fc25-squad-manager-low-20260505131402-2a8c6844.
- Activated fc25-squad-manager-low-20260505131402-2a8c6844 via explicit UI action.
- Audit actor squad-manager-ui; risk low.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/squad-manager-review.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/squad-manager-apply-modal.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-151352-SAST_assets/squad-manager-applied.png

## Direction-Only Assertions

- same-seed high pressing and fast tempo total fouls: PASS (10 -> 22, delta 12, 120.00%)

## Admin Apply Validation

- Source dataset: uat-fc26-pl20
- New inactive dataset: fc25-squad-manager-low-20260505131402-2a8c6844
- Activated dataset: fc25-squad-manager-low-20260505131402-2a8c6844
- Applied suggestions: uat-low-name-212831, uat-low-nationality-203376
- Audit actor: squad-manager-ui
- Audit risk level: low

