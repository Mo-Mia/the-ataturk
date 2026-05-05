### **FootSim Workbench: UAT Research Report**

**Run ID:** `UAT_RESEARCH_20260505-173110-SAST`
**Date:** 2026-05-05

---

#### **1. Executive Summary**

This report summarizes the User Acceptance Test (UAT) for the FootSim workbench. All 6 scenarios passed, confirming that core simulation surfaces, tactical calibration, and the Squad Manager admin workflow meet acceptance criteria. The system is stable and performs as expected against the defined requirements.

#### **2. Key Findings**

**2.1 Dashboard and Core Surfaces are Stable**

*   **Expectation:** The dashboard should expose active dataset health, and core simulation surfaces should be stable.
*   **Evidence:** The dashboard correctly reported the active `uat-fc26-pl20` dataset, sourced from the PL20 UAT fixture. All primary surfaces (Run, Replay, Compare, Batch) loaded and executed their functions without issue, demonstrating UI stability.

**2.2 Tactical Contrast Assertion Passed**

*   **Expectation:** More aggressive tactics (high pressing, fast tempo) should directionally increase foul pressure, per Phase 14b calibration.
*   **Evidence:** A same-seed comparison confirmed the expected directional outcome. The low-pressure baseline tactic produced 10 fouls, while the high-pressure variant produced 22 fouls. The assertion passed, validating the tactical model changes.

**2.3 Squad Manager Admin Flow Meets Requirements**

*   **Expectation:** The admin flow must enforce a safe, multi-step process for applying data changes, with clear auditing.
*   **Evidence:** The workflow performed exactly as specified:
    1.  **Review Mode:** The UI defaulted to a guarded review mode.
    2.  **Apply Creates New Version:** Applying two low-risk suggestions correctly created a new, inactive dataset version (`fc25-squad-manager-low-20260505153132-0dc66794`).
    3.  **Explicit Activation:** The new dataset version was activated via a separate, explicit UI action.
    4.  **Auditing:** The apply action was correctly audited with `actor: squad-manager-ui` and `risk: low`.

#### **3. Conclusion**

The FootSim workbench has successfully passed this UAT cycle. The platform demonstrates required stability in its core user-facing simulation tools and correctly implements the critical, safety-focused workflow for the Squad Manager.
