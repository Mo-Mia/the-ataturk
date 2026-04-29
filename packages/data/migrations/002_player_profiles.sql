-- Phase B Step 2A player profile schema.
--
-- Profile tier enum:
-- 'S' | 'A' | 'B' | 'C' | 'D'
--
-- Profile history field_name enum:
-- 'tier' | 'role_2004_05' | 'qualitative_descriptor'

PRAGMA foreign_keys = ON;

CREATE TABLE player_profile_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL,
  parent_version_id TEXT REFERENCES player_profile_versions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (is_active IN (0, 1))
);

CREATE UNIQUE INDEX player_profile_versions_one_active
ON player_profile_versions(is_active)
WHERE is_active = 1;

CREATE TABLE player_profiles (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  profile_version TEXT NOT NULL REFERENCES player_profile_versions(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  role_2004_05 TEXT,
  qualitative_descriptor TEXT,
  generated_by TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  edited INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (player_id, profile_version),
  CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  CHECK (edited IN (0, 1))
);

CREATE TABLE player_profile_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  profile_version TEXT NOT NULL REFERENCES player_profile_versions(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  CHECK (field_name IN ('tier', 'role_2004_05', 'qualitative_descriptor'))
);

CREATE INDEX player_profiles_player_id_profile_version_idx
ON player_profiles(player_id, profile_version);

CREATE INDEX player_profiles_profile_version_edited_idx
ON player_profiles(profile_version, edited);

CREATE INDEX player_profile_history_player_id_profile_version_changed_at_idx
ON player_profile_history(player_id, profile_version, changed_at);
