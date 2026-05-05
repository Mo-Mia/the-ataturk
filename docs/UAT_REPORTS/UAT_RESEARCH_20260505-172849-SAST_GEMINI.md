**FootSim Workbench: UAT Research Report**

- **Run ID:** `UAT_RESEARCH_20260505-172849-SAST`
- **Date:** `2026-05-05`
- **Overall Status:** **PASS**

---

### **Key Findings**

All tested scenarios passed, confirming core workbench functionality and the new Squad Manager administrative flow meet UAT expectations.

1.  **Dashboard & Core Surfaces**
    *   **Expectation:** The dashboard should show active dataset health, and core surfaces (run, replay, compare, batch) should load correctly.
    *   **Result:** Pass. The dashboard correctly reported the active `uat-fc26-pl20` dataset (20 clubs, 547 players). All simulation and analysis surfaces loaded and functioned as expected.
    *   **Evidence:** `scenarios.id: "dashboard"`, `"replay"`, `"formation-compare"`, `"batch-distribution"` all report `state: "pass"`.

2.  **Tactical Contrast Assertion**
    *   **Expectation:** Tactical contrast assertions should be directional, with more aggressive tactics increasing foul pressure.
    *   **Result:** Pass. The high pressing/fast tempo tactic variant produced a significant directional increase in fouls, satisfying the assertion.
    *   **Evidence:** Foul count increased from a baseline of 10 to 22. The `assertions` block confirms `state: "pass"` for the expected "increase". This aligns with the Phase 14b calibration anchor.

3.  **Squad Manager: Admin Workflow**
    *   **Expectation:** The admin flow must default to a guarded "review mode" and use a separate, explicit apply-then-activate sequence for dataset changes.
    *   **Result:** Pass. The workflow performed exactly as expected. Review mode was on by default, applying the change created a new inactive dataset version, and activation was a separate, explicit user action.
    *   **Evidence:** `scenarios.id: "admin-squad-manager"`. Observations confirm "Review mode defaulted on and guarded apply: yes". The `adminApply` block details the creation of the new dataset version `fc25-squad-manager-low-20260505152910-7312db58` and its subsequent, separate activation. Audit metadata (`auditActor`, `auditRiskLevel`) was correctly recorded.
