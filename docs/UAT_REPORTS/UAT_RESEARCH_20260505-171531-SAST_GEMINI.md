### **FootSim Workbench: UAT Research Report**

**Run ID:** `UAT_RESEARCH_20260505-171531-SAST`
**Overall Status:** **PASS**

This report summarizes the results of user acceptance testing against the FootSim workbench. All 6 scenarios passed, validating core simulation surfaces and the Squad Manager administrative workflow. Testing was performed against the `uat-fc26-pl20` dataset, which was correctly imported from the UAT fixture source for this run.

---

#### **Key Findings**

*   **Core Surfaces & Data Integrity:**
    *   The Dashboard correctly exposed the active `uat-fc26-pl20` dataset and its health metrics (20 clubs, 547 players).
    *   The Run, Replay, Compare, and Batch surfaces were stable and loaded successfully, confirming UI and data layer integration. A test replay of run `cec71bbd...` loaded the correct match artefact.

*   **Tactical Model Calibration:**
    *   The tactical contrast scenario met the Phase 14b expectation. More aggressive pressing and tempo tactics directionally increased foul pressure, raising the count from 10 to 22. This passed the direction-only assertion.

*   **Admin Workflow: Squad Manager:**
    *   The end-to-end admin flow performed as expected. The UI correctly defaulted to review mode, guarding the apply action.
    *   A low-risk apply successfully created a new, inactive dataset version (`fc25-squad-manager-low-20260505151541-1047c7a3`).
    *   The new dataset version was subsequently activated via a separate, explicit UI action.
    *   The change was correctly recorded with audit metadata: `actor: squad-manager-ui`, `risk: low`.

#### **Conclusion**

The FootSim workbench meets the acceptance criteria for the tested scenarios. The core simulation and administrative features are functioning as specified.
