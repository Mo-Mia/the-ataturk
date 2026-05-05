# FootSim Documentation and Structure Audit
Date: 2026-05-05
Auditor: Claude Opus 4.1 (Claude Code)
Scope: read-only diagnostic, no changes made

## Executive summary

The FootSim project demonstrates exceptional documentation discipline with comprehensive cross-referencing, clear calibration baseline management, and no broken internal links. The main concern is the accumulation of 26 session status files over six days and the growing DECISIONS.md (681 lines) without an archiving strategy. Code documentation relies heavily on descriptive naming over inline comments, with calibration constants lacking explanatory context.

## Findings by dimension

### 1. Document lifecycle and freshness

**Active and properly marked documents:**
- `docs/CALIBRATION_BASELINE_PHASE_14.md` - correctly marked as active baseline (updated 2026-05-05)
- `docs/CALIBRATION_BASELINE_PHASE_8.md` - properly marked as RETIRED (updated 2026-05-05)
- `docs/CALIBRATION_REFERENCE.md` - serves as coordination hub for all baselines

**Historical/superseded documents with clear status:**
- `docs/CALIBRATION_BASELINE_FC26.md` - marked superseded by Phase 12
- `docs/CALIBRATION_BASELINE_FC26_MULTI_MATCHUP.md` - marked superseded by Phase 13.5
- `docs/CALIBRATION_BASELINE_FC26_PL20.md` - historical Phase 13.5 baseline

**Potentially stale documents:**
- `docs/prompt_rubric_draft.md` - filename suggests draft status but used in production code
- `docs/ROADMAP.md` - not updated since project inception

### 2. Cross-reference integrity

**Exceptional integrity - zero broken links found:**
- All referenced markdown files exist (`PROJECT_BRIEF.md`, `LORE.md`, `PLAYER_MANAGER_MODE.md`, etc.)
- Phase investigation findings properly linked (PHASE_9, 10, 13, 16)
- Calibration documents maintain accurate cross-references

**Orphaned document:**
- `docs/PHASE_15_INVESTIGATION_FINDINGS.md` - exists but unreferenced by any other documentation

**Reference pattern:**
- Project uses backtick notation (`` `filename.md` ``) rather than markdown links
- Consistent but makes navigation less convenient in markdown viewers

### 3. Naming and organisation conventions

**Strong naming conventions:**
- Session status: `SESSION_STATUS_YYYY-MM-DD_HHMM_SAST.md` (consistent)
- Calibration baselines: `CALIBRATION_BASELINE_[IDENTIFIER].md` (consistent)
- Phase investigations: `PHASE_N_INVESTIGATION_FINDINGS.md` (consistent)
- UAT reports: `UAT_RESEARCH_YYYYMMDD-HHMMSS-SAST.[json|md]` (consistent)

**Minor inconsistency:**
- First session status lacks timestamp: `SESSION_STATUS_2026-04-30.md` vs others with full timestamps
- Lowercase filename: `docs/prompt_rubric_draft.md` vs uppercase convention elsewhere

**Flat documentation structure:**
- All 57 markdown files in single `docs/` directory
- UAT reports properly segregated in `docs/UAT_REPORTS/`

### 4. Content redundancy and contradiction

**No contradictions found** - all active/retired status statements align.

**Significant redundancy identified:**
- Calibration value table duplicated in `UAT_FOOTSIM_ANALYST_PROMPT.md:41-45` and `CALIBRATION_BASELINE_PHASE_14.md:30-34` (identical values)
- Dataset version `fc25-20260504102445-4399cb2b-a504ee92` repeated across 8+ files
- Phase 14b/17 active baseline statement repeated nearly identically in multiple documents

**Intentional redundancy:**
- Real-PL bands appear in multiple contexts but serve different documentation purposes

### 5. Code-adjacent documentation

**Package-level READMEs present and comprehensive:**
- `packages/match-engine/README.md` - player attributes, characterisation commands
- `packages/data/README.md` - SQLite layer, migrations, FC25 imports
- `apps/web/README.md` - frontend routes, admin setup, API costs
- `server/README.md` - backend endpoints, LLM integration

**Code documentation gaps:**
- `packages/match-engine/src/calibration/constants.ts` - minimal inline documentation
- `packages/match-engine/src/calibration/probabilities.ts` - hundreds of magic numbers without explanatory comments
- No JSDoc on public APIs
- Critical calibration values lack source/methodology documentation

**Technical debt tracking:**
- Zero TODO comments in source code
- Zero FIXME comments in source code
- `docs/BACKLOG.md` serves as centralised tracking (643 lines, well-maintained)

### 6. Project structure clarity

**Clear monorepo structure:**
```
apps/
  web/          # Vite + React frontend
packages/
  match-engine/ # Core football simulation
  data/         # SQLite data layer
  commentary/   # LLM commentary (unused)
  engine/       # Legacy wrapper (deprecated)
  tactics/      # Tactical system
  tts/          # Text-to-speech (unused)
server/         # Fastify backend
scripts/        # UAT research scripts
docs/           # All documentation (flat)
data/           # FC25/FC26 CSV imports
```

**Ambiguous elements:**
- `packages/engine/` vs `packages/match-engine/` - unclear deprecation status
- `packages/commentary/` and `packages/tts/` - appear unused but not marked deprecated
- `scripts/` contains only UAT files - other scripts may be missing or elsewhere

### 7. Session status and decision log accumulation

**Growing without archival strategy:**
- **26 SESSION_STATUS files** in 6 days (2026-04-30 to 2026-05-05)
- Multiple sessions per day (up to 9 on 2026-05-03)
- Each file 30-150 lines
- No archival, rotation, or cleanup strategy documented

**DECISIONS.md approaching unwieldy:**
- **681 lines**, 31 decisions
- Append-only since 2026-04-29
- Newest-first order maintained
- Average ~22 lines per decision
- No pagination or archival strategy

**BACKLOG.md well-maintained:**
- 643 lines with clear sections
- Completed items marked with ✅
- Active categorisation (Workbench UI, Engine, Admin, etc.)

### 8. UAT report repository growth

**Current state manageable but trending toward concern:**
- `docs/UAT_REPORTS/` currently 1.8MB
- 3 asset directories with 7 PNG screenshots total
- Each UAT run generates JSON + MD + screenshots

**Growth projection concern:**
- Decision documented: "Reports and screenshots are committed... deliberate reviewability trade-off and future repo-growth vector"
- BACKLOG tracks "UAT report archiving" as pending
- At current rate, could reach 50-100MB within months

## Prioritised recommendations

**1. Implement session status archival strategy**
- **Recommendation:** Move sessions older than 7 days to `docs/archive/session_status/`
- **Files affected:** 26 existing SESSION_STATUS files
- **Priority:** High
- **Effort estimate:** Small
- **Rationale:** Prevents docs/ directory clutter, maintains recent session visibility

**2. Document calibration constant sources**
- **Recommendation:** Add explanatory comments to probabilities.ts magic numbers
- **Files affected:** `packages/match-engine/src/calibration/probabilities.ts`
- **Priority:** High
- **Effort estimate:** Medium
- **Rationale:** Critical for understanding engine behaviour and future tuning

**3. Consolidate calibration value tables**
- **Recommendation:** Single source of truth for active calibration values, referenced elsewhere
- **Files affected:** `UAT_FOOTSIM_ANALYST_PROMPT.md`, `CALIBRATION_BASELINE_PHASE_14.md`
- **Priority:** Medium
- **Effort estimate:** Small
- **Rationale:** Reduces maintenance burden and prevents divergence

**4. Add JSDoc to public APIs**
- **Recommendation:** Document match-engine exports and server endpoints
- **Files affected:** `packages/match-engine/src/index.ts`, `server/src/routes/*.ts`
- **Priority:** Medium
- **Effort estimate:** Medium
- **Rationale:** Improves maintainability for multi-agent development

**5. Implement UAT report rotation**
- **Recommendation:** Keep last N reports, archive older ones off-repo
- **Files affected:** `docs/UAT_REPORTS/`
- **Priority:** Medium
- **Effort estimate:** Small
- **Rationale:** Prevents repository bloat from screenshot accumulation

**6. Reference orphaned PHASE_15 findings**
- **Recommendation:** Add reference in CALIBRATION_REFERENCE.md or relevant decision entry
- **Files affected:** `docs/PHASE_15_INVESTIGATION_FINDINGS.md`
- **Priority:** Low
- **Effort estimate:** Small
- **Rationale:** Maintains documentation completeness

**7. Clarify deprecated package status**
- **Recommendation:** Add deprecation notices to unused packages
- **Files affected:** `packages/engine/`, `packages/commentary/`, `packages/tts/`
- **Priority:** Low
- **Effort estimate:** Small
- **Rationale:** Prevents confusion about active vs legacy code

**8. Consider DECISIONS.md pagination**
- **Recommendation:** Split into yearly/quarterly files when reaching 1000 lines
- **Files affected:** `docs/DECISIONS.md`
- **Priority:** Low
- **Effort estimate:** Small
- **Rationale:** Maintains readability as project continues

## Items deliberately not addressed

- **Documentation reorganisation into subdirectories** - current flat structure works well at current scale
- **Converting backtick references to markdown links** - consistent current pattern, low impact
- **Standardising prompt_rubric_draft.md filename** - actively used, rename would break code
- **Adding TODO comments to source** - BACKLOG.md serves this purpose effectively
- **Real-time documentation generation** - overhead not justified at current project stage

## Audit methodology

The audit was conducted using Claude Code with full repository access. The methodology involved:

1. Initial orientation through latest SESSION_STATUS, active calibration baseline, DECISIONS.md, BACKLOG.md, and UAT contract
2. Systematic file listing and pattern analysis of docs/ directory
3. Grep-based search for cross-references, broken links, and redundant content
4. Sampling of package-level documentation and source code
5. Statistical analysis of file counts and sizes
6. Content comparison for redundancy detection

All findings are grounded in specific file paths and line numbers. The audit maintained read-only access throughout, making no modifications to the repository.