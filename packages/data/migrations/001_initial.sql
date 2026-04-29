-- Initial Phase A data schema.
--
-- Position enum values used by players.position_primary and players.position_secondary:
-- 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST'

PRAGMA foreign_keys = ON;

CREATE TABLE clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  country TEXT NOT NULL,
  league TEXT NOT NULL,
  manager_real TEXT NOT NULL,
  stadium_name TEXT NOT NULL,
  stadium_capacity INTEGER,
  kit_primary_hex TEXT,
  kit_secondary_hex TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (stadium_capacity IS NULL OR stadium_capacity > 0),
  CHECK (kit_primary_hex IS NULL OR kit_primary_hex GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  CHECK (kit_secondary_hex IS NULL OR kit_secondary_hex GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE player_dataset_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL,
  parent_version_id TEXT REFERENCES player_dataset_versions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (is_active IN (0, 1))
);

CREATE UNIQUE INDEX player_dataset_versions_one_active
ON player_dataset_versions(is_active)
WHERE is_active = 1;

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  squad_number INTEGER,
  position_primary TEXT NOT NULL,
  position_secondary TEXT,
  date_of_birth TEXT,
  nationality TEXT NOT NULL,
  height_cm INTEGER,
  is_captain INTEGER NOT NULL DEFAULT 0,
  is_eligible_european INTEGER NOT NULL DEFAULT 1,
  injury_status TEXT NOT NULL DEFAULT 'fit',
  fitness INTEGER NOT NULL DEFAULT 100,
  form INTEGER NOT NULL DEFAULT 50,
  real_player_reference TEXT,
  player_origin TEXT NOT NULL DEFAULT 'real',
  user_id TEXT,
  preset_archetype TEXT,
  budget_used INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (squad_number IS NULL OR squad_number > 0),
  CHECK (position_primary IN ('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST')),
  CHECK (position_secondary IS NULL OR position_secondary IN ('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST')),
  CHECK (height_cm IS NULL OR height_cm > 0),
  CHECK (is_captain IN (0, 1)),
  CHECK (is_eligible_european IN (0, 1)),
  CHECK (injury_status IN ('fit', 'doubt', 'injured', 'long-term')),
  CHECK (fitness BETWEEN 0 AND 100),
  CHECK (form BETWEEN 0 AND 100),
  CHECK (player_origin IN ('real', 'user_created')),
  CHECK (preset_archetype IS NULL OR preset_archetype IN ('target-man', 'speedy-winger', 'trequartista', 'box-to-box', 'deep-lying-playmaker', 'ball-playing-defender', 'marauding-full-back', 'sweeper-keeper', 'blank-slate')),
  CHECK (budget_used IS NULL OR budget_used >= 0),
  CHECK (
    (player_origin = 'real' AND user_id IS NULL AND preset_archetype IS NULL AND budget_used IS NULL)
    OR
    (player_origin = 'user_created' AND user_id IS NOT NULL AND preset_archetype IS NOT NULL AND budget_used IS NOT NULL)
  )
);

CREATE TABLE player_attributes (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  dataset_version TEXT NOT NULL REFERENCES player_dataset_versions(id) ON DELETE CASCADE,
  passing INTEGER NOT NULL,
  shooting INTEGER NOT NULL,
  tackling INTEGER NOT NULL,
  saving INTEGER NOT NULL,
  agility INTEGER NOT NULL,
  strength INTEGER NOT NULL,
  penalty_taking INTEGER NOT NULL,
  perception INTEGER NOT NULL,
  jumping INTEGER NOT NULL,
  control INTEGER NOT NULL,
  rationale TEXT,
  generated_by TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (player_id, dataset_version),
  CHECK (passing BETWEEN 0 AND 100),
  CHECK (shooting BETWEEN 0 AND 100),
  CHECK (tackling BETWEEN 0 AND 100),
  CHECK (saving BETWEEN 0 AND 100),
  CHECK (agility BETWEEN 0 AND 100),
  CHECK (strength BETWEEN 0 AND 100),
  CHECK (penalty_taking BETWEEN 0 AND 100),
  CHECK (perception BETWEEN 0 AND 100),
  CHECK (jumping BETWEEN 0 AND 100),
  CHECK (control BETWEEN 0 AND 100)
);

CREATE TABLE player_attribute_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  dataset_version TEXT NOT NULL REFERENCES player_dataset_versions(id) ON DELETE CASCADE,
  attribute_name TEXT NOT NULL,
  old_value INTEGER NOT NULL,
  new_value INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  CHECK (attribute_name IN ('passing', 'shooting', 'tackling', 'saving', 'agility', 'strength', 'penalty_taking', 'perception', 'jumping', 'control')),
  CHECK (old_value BETWEEN 0 AND 100),
  CHECK (new_value BETWEEN 0 AND 100)
);

CREATE TABLE fixtures (
  id TEXT PRIMARY KEY,
  home_club_id TEXT NOT NULL REFERENCES clubs(id),
  away_club_id TEXT NOT NULL REFERENCES clubs(id),
  round TEXT NOT NULL,
  leg INTEGER NOT NULL,
  kicked_off_at TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  venue_city TEXT NOT NULL,
  real_result_home_goals INTEGER,
  real_result_away_goals INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (round IN ('group', 'r16', 'qf', 'sf', 'final')),
  CHECK (leg IN (1, 2)),
  CHECK (home_club_id <> away_club_id),
  CHECK (real_result_home_goals IS NULL OR real_result_home_goals >= 0),
  CHECK (real_result_away_goals IS NULL OR real_result_away_goals >= 0)
);

CREATE INDEX players_club_id_idx ON players(club_id);
CREATE INDEX players_player_origin_idx ON players(player_origin);
CREATE INDEX player_attributes_player_id_dataset_version_idx ON player_attributes(player_id, dataset_version);
CREATE INDEX player_attribute_history_player_id_dataset_version_changed_at_idx ON player_attribute_history(player_id, dataset_version, changed_at);
CREATE INDEX fixtures_round_kicked_off_at_idx ON fixtures(round, kicked_off_at);
