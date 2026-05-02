# FootSim UAT Phase 3 — Recording Session Script

**Date:** 2 May 2026
**Phase under test:** Phase 3 (engine-quality bundle: 90-minute support + formation-aware XI)
**Target session length:** 12–15 minutes
**Tools:** Kazam (screen + microphone), local FootSim build at `http://127.0.0.1:5175`
**Companion doc:** `docs/UAT_FOOTSIM_ANALYST_PROMPT.md` — paste this into Gemini AI Studio after recording

---

## Pre-flight (3 minutes, not part of the recording)

1. Server running at `http://127.0.0.1:8005` — `curl http://127.0.0.1:8005/api/health` returns OK.
2. Web running at `http://127.0.0.1:5175`.
3. Active FC25 dataset present — visit `/visualise/run`, confirm five clubs in dropdown (Arsenal, Manchester City, Manchester United, Liverpool, Aston Villa).
4. Run history not empty — if blank, kick off a single sim before recording so a baseline is visible.
5. Kazam configured: full-screen capture + system audio + microphone, output to `.mp4`. Test recording 5 seconds and play back to confirm audio level.
6. Browser zoom at 100%, dev tools closed, Slack/email notifications muted. Plain background, no other tabs visible.
7. Tea or water within reach. Talking for 15 minutes is dehydrating.

## Recording session — narrate aloud throughout

The analyst hears what you say. Treat it like a video walkthrough for a colleague who's never seen the tool. Speak in plain English. Don't filter for "professionalism" — honest reactions are exactly what makes the recording useful. If something looks wrong, say it looks wrong. If something looks right, say that too.

Each step has narration prompts in *italics*. These are guides, not scripts. Talk past them where it makes sense.

---

### Step 1 — Single match, fixed seed (3 minutes)

**Action:** Open `/visualise/run`. Set up:

- Home: Liverpool, formation 4-3-3
- Away: Arsenal, formation 4-2-3-1
- All other tactics: defaults (balanced mentality, normal tempo, medium pressing, normal line height, normal width)
- Seed: `12345`
- Batch: 1
- Duration: Full match
- Click Run

**Narration prompts:**

- *Before clicking Run: "I'm setting up Liverpool 4-3-3 vs Arsenal 4-2-3-1, default tactics, fixed seed 12345, full 90 minutes."*
- *When result lands: read the score, total shots, possession aloud. "Liverpool X-Y Arsenal, X shots to Y, X% possession to Liverpool."*
- *React: "This feels [realistic / high / low / unusual] for a Liverpool-Arsenal fixture."*

**Action:** Expand the run history row to show the XIs. Read a few player names aloud.

**Narration prompts:**

- *"Liverpool's XI in 4-3-3: [name 3-4 players]. Arsenal's XI in 4-2-3-1: [name 3-4]. Both look like plausible starting elevens."*

**Action:** Click into the replay. Let the first ~30 seconds play.

**Narration prompts:**

- *"Players are [moving sensibly / clumping / spreading too wide / not pressing / static]."*
- *Note any specific weird behaviour with timestamps. "At 03:12 the right-back is doing X, which looks odd."*

---

### Step 2 — Tactical contrast, same seed (3 minutes)

**Action:** Back to `/visualise/run`. Same matchup, same seed (12345), but change Liverpool's pressing to high and tempo to fast. Run.

**Narration prompts:**

- *"Same matchup, same seed. Only Liverpool's tactics changed: pressing now high, tempo now fast. I'd expect more fouls, more turnovers, possibly more shots — but a higher chance of giving up clear chances on transition."*
- *When result lands: "Compared to Run 1, this run has [more/fewer/similar] X. That [matches / doesn't match] my expectation."*

**Action:** Open both runs in compare view (`/visualise/compare?a=<run1Id>&b=<run2Id>`).

**Narration prompts:**

- *"XI display at the top: same XI both runs since I didn't change formation. Just tactics."*
- *"Stats side-by-side: [observe specific differences]."*
- *"Heatmaps: Liverpool's territory looks [further up / similar / pulled back]. Arsenal's looks [different in some way / the same]."*
- *Try to identify whether the comparison reveals real tactical effect or just seed-driven noise.*

---

### Step 3 — Formation contrast, same seed (3 minutes)

**Action:** Back to `/visualise/run`. Same teams, default tactics, but run two matches:

- Run A: Liverpool 4-3-3 vs Arsenal 4-2-3-1, seed `67890`
- Run B: Liverpool 4-4-2 vs Arsenal 4-2-3-1, seed `67890`

**Narration prompts:**

- *"Same Liverpool squad, same seed, but switching from 4-3-3 to 4-4-2. The XI selector should pick different players for the wide roles — 4-3-3 wants wingers, 4-4-2 wants wide midfielders. Let's see who comes in and who comes out."*

**Action:** Expand both run history rows to show the XIs.

**Narration prompts:**

- *"In 4-3-3 Liverpool's XI included [name a wide forward]. In 4-4-2 it includes [different player] in their place. That [makes sense / is surprising] because [reason]."*

**Action:** Open both in compare view.

**Narration prompts:**

- *"XI display shows the personnel difference clearly. Stats differ because: [hypothesis based on personnel]."*
- *"Match shape differences in the heatmaps: [observation]."*

---

### Step 4 — Distribution view (3 minutes)

**Action:** Back to `/visualise/run`. Liverpool 4-3-3 vs Arsenal 4-2-3-1 with default tactics, batch 50, seed 1.

**Narration prompts:**

- *"Running 50 seeds. I'm expecting roughly normal distributions around the calibrated mean — somewhere around 16-17 total shots, 2-3 total goals."*
- *Wait for completion (should be a few seconds). Navigate to the batch URL when ready.*

**Action:** Inspect each histogram in `/visualise/batch/:batchId`.

**Narration prompts:**

- *For goals: "Goals histogram shows [shape]. Mean [number]. Spread is [tight / wide / skewed]."*
- *For shots: "Shots histogram looks [comment]."*
- *For possession: "Possession is centred around [number]%, which [matches / surprises]."*
- *For fouls and cards: "[comment]."*

**Action:** Click a bar at the high end of the goals histogram. Watch the resulting replay briefly.

**Narration prompts:**

- *"Opening the highest-scoring run from this batch. Score was [X-Y]."*
- *Watch 30-60 seconds of replay. "Why does this run produce more goals? [hypothesis: better chance creation, weaker keeper performance, defensive lapse, lucky finishing]."*

---

### Step 5 — Surprise check (1-2 minutes)

**Action:** Pick any two clubs and any two formations you haven't tried yet. Run a single match. Note anything unexpected.

**Narration prompts:**

- *"Trying [matchup, formation pair] as a sanity check on something I haven't seen yet."*
- *"Result: [score]. [Plausible / surprising / odd]. [Brief reason]."*

**Action:** If anything stood out — strange XI, weird movement, unrealistic stat — go look at it specifically and narrate.

---

## Wrap (~30 seconds, on camera)

**Narration prompts:**

- *"Closing thoughts before stopping the recording: the workbench feels [observation]. The biggest thing I want the analyst to look at is [one specific concern, if any]."*

Stop Kazam.

---

## Post-session (5-10 minutes)

1. Verify the recording captured both screen and audio. Spot-check at the start, middle, and end.
2. Trim obvious dead time at start/end if needed.
3. Open Gemini AI Studio. Use Gemini 3.1 Pro Preview.
4. Paste the entire contents of `docs/UAT_FOOTSIM_ANALYST_PROMPT.md` as the system prompt.
5. Attach the video.
6. Run.
7. Save the analyst's report to `docs/UAT_REPORTS/UAT_PHASE_3_<YYYY-MM-DD>_<HH>h<MM>.md`. Create the directory if it doesn't exist.
8. Triage findings:
   - **P0** → blocks Phase 4 sprint, address before scoping
   - **P1** → BACKLOG with priority flag
   - **P2 / P3** → BACKLOG

---

## What good output from this session looks like

- A 12–15 minute video where Mo's narration explains intent before each action
- The analyst's report covers all ten dimensions from the prompt doc
- Concrete recommendations with severity flags
- At least one or two genuinely surprising findings — if the report is uniformly "everything looks fine", the recording probably wasn't probing enough

If the analyst comes back with a flat "all good" and Mo's gut says otherwise, re-record with more deliberate stress-testing in Step 5.
