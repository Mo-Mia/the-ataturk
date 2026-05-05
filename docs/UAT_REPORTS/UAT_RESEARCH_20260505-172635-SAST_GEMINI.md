**UAT Research Report: FootSim Workbench**

*   **Run ID:** `UAT_RESEARCH_20260505-172635-SAST`
*   **Date:** 2026-05-05
*   **Overall Status:** **PASS**

---

### **1. Executive Summary**

The UAT run completed successfully, with all 6 scenarios passing. Core workbench surfaces for running, replaying, and comparing simulations are stable. The Squad Manager admin flow for low-risk data changes meets all specifications, including default review mode and a separate apply/activate sequence. Tactical model changes related to pressing (Phase 14b) behave as expected.

### **2. Key Findings**

*   **Dashboard & Core Surfaces:**
    *   The Dashboard correctly exposed the active `uat-fc26-pl20` dataset health (20 clubs, 547 players).
    *   Run, Replay, Compare, and Batch surfaces loaded successfully, confirming the stability of primary user flows.

*   **Squad Manager Admin Flow:**
    *   The workflow correctly defaulted to review mode, preventing unintentional changes.
    *   A low-risk apply of 2 suggestions created a new, inactive dataset version (`fc25-squad-manager-low-...-e8965a7f`) with appropriate audit metadata (`actor: squad-manager-ui`, `risk: low`).
    *   Activation of the new dataset version was confirmed as a separate, explicit user action.

### **3. Tactical & Data Assertions**

*   **Tactical Contrast (Phase 14b Calibration):**
    *   The directional assertion for more aggressive tactics passed. The "High pressing/fast tempo" variant produced 22 fouls, a significant increase over the baseline of 10, aligning with expectations.

*   **Data Integrity:**
    *   The run correctly used the specified PL20 UAT fixture (`.../FC26_20250921.csv`), ensuring data correctness as per test requirements.
