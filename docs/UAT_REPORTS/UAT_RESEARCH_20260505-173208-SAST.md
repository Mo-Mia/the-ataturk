# FootSim UAT Research Report UAT_RESEARCH_20260505-173208-SAST

Started: 2026-05-05T15:32:08.561Z
Finished: 2026-05-05T15:33:04.434Z
State: PASS
Evidence JSON: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST.json
Gemini report: not requested

## Run Configuration

- Batch size: 5
- AI interpretation: off (--no-ai)
- Admin verification: live APIs
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
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/dashboard.png

### Run And Replay

State: PASS

- Created run 1f10e7e7-6825-4ea8-b1ff-c17d953129f9 with seed 260501.
- Replay loaded artefact match-engine-20260505153211-liv-mci-seed-260501-d5ccef84.json.
- Score 2-1; shots 19-16; fouls 8-12.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/replay.png

### Tactical Contrast

State: PASS

- Compared same teams and seed 260502.
- Low pressing/slow tempo fouls: 10.
- High pressing/fast tempo fouls: 22.
- Assertion is direction-only; magnitude is retained as context.

### Formation Compare

State: PASS

- Compared run 1f10e7e7-6825-4ea8-b1ff-c17d953129f9 with run 35a9bca4-7781-481f-97c5-c34d0b4da53b.
- Home XI changed: yes.
- Compare page loaded the line-up and summary surfaces.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/compare.png

### Batch Distribution

State: PASS

- Created 5 runs in batch af2b335d-3165-4c2e-aee9-3efa43bb78f8.
- Mean goals: 2.00.
- Mean shots: 24.40.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/batch.png

### Squad Manager Verify Apply Activate

State: PASS

- Review mode defaulted on and guarded apply: yes.
- Applied 43 low-risk fixture suggestions.
- Created inactive dataset version fc25-squad-manager-low-20260505153303-89526839.
- Activated fc25-squad-manager-low-20260505153303-89526839 via explicit UI action.
- Audit actor squad-manager-ui; risk low.
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/squad-manager-review.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/squad-manager-apply-modal.png
- Screenshot: docs/UAT_REPORTS/UAT_RESEARCH_20260505-173208-SAST_assets/squad-manager-applied.png

## Direction-Only Assertions

- same-seed high pressing and fast tempo total fouls: PASS (10 -> 22, delta 12, 120.00%)

## Admin Apply Validation

- Source dataset: uat-fc26-pl20
- New inactive dataset: fc25-squad-manager-low-20260505153303-89526839
- Activated dataset: fc25-squad-manager-low-20260505153303-89526839
- Applied suggestions: sug-03a1e91c-815f-4f0e-9622-1eab3f994806, sug-078c9815-3d51-43fc-b55f-16c2a0ae00f1, sug-0cc2b61d-9f01-44e6-a338-d0ad200a355f, sug-1411935e-75ba-4b06-8dd3-c0f5cc9ac01b, sug-27a9bd7f-41da-4486-b45c-b701e1902760, sug-27fb24b9-a137-4543-95e5-e168df39a74e, sug-2a516d0d-153c-4976-804c-716bea7e7456, sug-2d0e6257-42c1-415a-a741-f36a0751c1b5, sug-3ca13af7-4e7e-4c18-9479-80fc2f1b1c70, sug-4a6ead2c-f81d-4257-9017-3851e2cacf8d, sug-50cb0a06-d927-4cbd-a8b1-7d9cec025204, sug-54fcdd95-d834-4bee-9712-c624516d133a, sug-5a1eb021-7fde-4ff3-a3bb-7c5b7dc2db1c, sug-647a517f-002b-445b-96ee-9c1055c11add, sug-6590fd20-e081-4bba-ab2c-7bdd07444230, sug-695c974d-cd94-4c5f-9ce8-250ecd8ae9fe, sug-6a9e3c48-d387-4e26-8f69-0758f1d2b45d, sug-6f3127b1-5c6c-4379-b11f-840101150d46, sug-723a1382-da5c-4f51-b599-d5581f0da44b, sug-73c7dcbd-918a-449b-a1ee-a13e75183de0, sug-75e7ddfa-b5c1-4c36-bcd8-2e338770f9e9, sug-7a2cd664-36ab-47da-bdcb-667508456747, sug-7d292720-d3ea-4632-b138-da103d524fdf, sug-86978353-c0b6-4b38-adfb-32f800dbe578, sug-8d1e6009-9f6f-4cd7-8da7-b7e2d5dddf3b, sug-a5ffdd22-37cd-4837-931c-3d60af2b4328, sug-ac0f2dd0-778a-4167-ab1a-442dfd648cd0, sug-b06ecae8-7c76-4df4-a59f-a69335e82898, sug-b15d0f65-2403-4605-84b0-9c119c38d183, sug-b2bbf8c5-fbf9-4cae-ac65-9728adc1eda1, sug-b8675ebc-bbff-42e7-9cb2-9a25982156a8, sug-ba206f14-21ed-4080-adb1-5d65d2e8f455, sug-c63ee682-5def-4bd3-9886-f8aa021e3aa7, sug-c71ab813-78ab-48e5-9642-10c5489779c8, sug-cc6bbe51-7464-4dfc-8b3b-014164408b68, sug-d35638fa-19b7-4b99-81ae-25456820eb06, sug-d57fe352-dece-4374-b0a7-135d21e1a865, sug-df1e13d1-bd41-4b83-8fcb-b61fe1fbee51, sug-e5ff3c41-ff0f-4642-aac6-0efbf764e2c3, sug-e68ac0ce-4cf7-4a5b-a1f7-91e55296ab52, sug-e6b1cc76-3407-4117-a3c2-0a2bd536b5d6, sug-f23a1b7d-2eb3-467d-8400-841b93946571, sug-fd128bcc-3d8d-4ed2-a31c-7498aa8e0abe
- Audit actor: squad-manager-ui
- Audit risk level: low

