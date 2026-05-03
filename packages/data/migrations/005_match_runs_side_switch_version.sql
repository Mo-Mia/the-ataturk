-- Backfill legacy match-run summaries with the pre-Phase-7 side-switch version.
--
-- New runs write sideSwitchVersion = 1. Existing rows are explicitly marked 0
-- so old artefacts keep the first-half-direction-throughout visualiser
-- interpretation.

PRAGMA foreign_keys = ON;

UPDATE match_runs
SET summary = json_set(summary, '$.sideSwitchVersion', 0)
WHERE json_extract(summary, '$.sideSwitchVersion') IS NULL;
