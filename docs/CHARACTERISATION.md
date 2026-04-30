# Match Engine Characterisation Report

Created: 2026-04-30

## Overview
To validate the realism of the `footballsimulationengine` (v5.0.0 adapter), we built a characterisation tool (`server/src/match/characterise.ts`) that runs the second half of the 2005 UCL Final across N seeds and reports aggregate statistics.

## Technical Findings

### Upstream Bug: Null Reference in Tackle Logic
During a 50-seed run, the engine crashed at seed 32. We traced this to a truthiness bug in the engine's internal player discovery logic.

- **Location**: `node_modules/footballsimulationengine/lib/actions.js`
- **Bug**: `if (index)` was used to check the result of `findIndex`. This caused a crash on `-1` (player not found) and a silent skip on `0` (first player in list).
- **Fix**: Patched to `if (index > -1)`.
- **Status**: Fixed via local patch in `node_modules`. Long-term recommendation is `patch-package`.

### Realism Baseline (v0.1)
Run across 50 seeds (Liverpol 0-3 Milan start, 450 iterations):

| Metric | Min | Max | Avg |
| :--- | :--- | :--- | :--- |
| Liverpool Goals (2nd half) | 0 | 1 | 0.1 |
| Milan Goals (2nd half) | 0 | 1 | 0.02 |
| Total Shots (2nd half) | 0 | 5 | 1.2 |
| Total Fouls | 0 | 2 | 0.3 |
| Semantic Events | 0 | 10 | 2.4 |

### Distribution of Scores (90 mins)
- **0-3**: 88%
- **1-3**: 10%
- **0-4**: 2%
- **3-3 (Historical)**: 0%

## Diagnosis: Sparse Event Frequency
The vertical slice initially reported only ~2 events per match. Characterisation confirms this is **engine behavior pattern**. The engine is extremely conservative with the current v2-llm-derived-final attributes. 

**Root Causes**:
1. **Conservative Action Selection**: The engine's action weights (`actions.js`) heavily favor movement over active ball actions (shots/passes) unless proximity thresholds are met.
2. **Attribute Sensitivity**: The engine's core constants may be washing out the high `attacking` and `shooting` attributes of our historical 2005 XI.

## Recommendations for v0.2
1. **Tactics Layer Implementation**: v0.2 MUST implement tactical modifiers to "tilt" the engine toward higher aggression to make the 2D visualization engaging.
2. **Attribute Re-scaling**: Consider a normalization pass on player attributes if the tactics layer isn't enough to drive shots up to ~5-10 per half.
3. **Engine Patching**: If tactical modifiers fail, we may need to patch `populateActionsJSON` in the engine to increase the "points" for shooting and passing actions.
