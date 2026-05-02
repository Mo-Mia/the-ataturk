-- FC25-backed FootSim data schema.
--
-- Additive only: these tables sit alongside the existing Atatürk data model.

PRAGMA foreign_keys = ON;

CREATE TABLE fc25_dataset_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  is_active INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (is_active IN (0, 1))
);

CREATE UNIQUE INDEX fc25_dataset_versions_one_active
ON fc25_dataset_versions(is_active)
WHERE is_active = 1;

CREATE TABLE fc25_clubs (
  dataset_version_id TEXT NOT NULL REFERENCES fc25_dataset_versions(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  country TEXT NOT NULL,
  league TEXT NOT NULL,
  fc25_team_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (dataset_version_id, id),
  UNIQUE (dataset_version_id, fc25_team_id)
);

CREATE TABLE fc25_players (
  dataset_version_id TEXT NOT NULL REFERENCES fc25_dataset_versions(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  fc25_player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  overall INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  position TEXT NOT NULL,
  alternative_positions TEXT NOT NULL,
  age INTEGER NOT NULL,
  nationality TEXT NOT NULL,
  height_cm INTEGER NOT NULL,
  weight_kg INTEGER NOT NULL,
  preferred_foot TEXT NOT NULL,
  weak_foot_rating INTEGER NOT NULL,
  skill_moves_rating INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  play_style TEXT,
  acceleration INTEGER NOT NULL,
  sprint_speed INTEGER NOT NULL,
  finishing INTEGER NOT NULL,
  shot_power INTEGER NOT NULL,
  long_shots INTEGER NOT NULL,
  positioning INTEGER NOT NULL,
  volleys INTEGER NOT NULL,
  penalties INTEGER NOT NULL,
  vision INTEGER NOT NULL,
  crossing INTEGER NOT NULL,
  free_kick_accuracy INTEGER NOT NULL,
  short_passing INTEGER NOT NULL,
  long_passing INTEGER NOT NULL,
  curve INTEGER NOT NULL,
  dribbling INTEGER NOT NULL,
  agility INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  reactions INTEGER NOT NULL,
  ball_control INTEGER NOT NULL,
  composure INTEGER NOT NULL,
  interceptions INTEGER NOT NULL,
  heading_accuracy INTEGER NOT NULL,
  defensive_awareness INTEGER NOT NULL,
  standing_tackle INTEGER NOT NULL,
  sliding_tackle INTEGER NOT NULL,
  jumping INTEGER NOT NULL,
  stamina INTEGER NOT NULL,
  strength INTEGER NOT NULL,
  aggression INTEGER NOT NULL,
  gk_diving INTEGER,
  gk_handling INTEGER,
  gk_kicking INTEGER,
  gk_positioning INTEGER,
  gk_reflexes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (dataset_version_id, id),
  UNIQUE (dataset_version_id, fc25_player_id),
  CHECK (overall BETWEEN 0 AND 100),
  CHECK (rank > 0),
  CHECK (position IN ('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST')),
  CHECK (age > 0),
  CHECK (height_cm > 0),
  CHECK (weight_kg > 0),
  CHECK (preferred_foot IN ('left', 'right', 'either')),
  CHECK (weak_foot_rating BETWEEN 1 AND 5),
  CHECK (skill_moves_rating BETWEEN 1 AND 5),
  CHECK (acceleration BETWEEN 0 AND 100),
  CHECK (sprint_speed BETWEEN 0 AND 100),
  CHECK (finishing BETWEEN 0 AND 100),
  CHECK (shot_power BETWEEN 0 AND 100),
  CHECK (long_shots BETWEEN 0 AND 100),
  CHECK (positioning BETWEEN 0 AND 100),
  CHECK (volleys BETWEEN 0 AND 100),
  CHECK (penalties BETWEEN 0 AND 100),
  CHECK (vision BETWEEN 0 AND 100),
  CHECK (crossing BETWEEN 0 AND 100),
  CHECK (free_kick_accuracy BETWEEN 0 AND 100),
  CHECK (short_passing BETWEEN 0 AND 100),
  CHECK (long_passing BETWEEN 0 AND 100),
  CHECK (curve BETWEEN 0 AND 100),
  CHECK (dribbling BETWEEN 0 AND 100),
  CHECK (agility BETWEEN 0 AND 100),
  CHECK (balance BETWEEN 0 AND 100),
  CHECK (reactions BETWEEN 0 AND 100),
  CHECK (ball_control BETWEEN 0 AND 100),
  CHECK (composure BETWEEN 0 AND 100),
  CHECK (interceptions BETWEEN 0 AND 100),
  CHECK (heading_accuracy BETWEEN 0 AND 100),
  CHECK (defensive_awareness BETWEEN 0 AND 100),
  CHECK (standing_tackle BETWEEN 0 AND 100),
  CHECK (sliding_tackle BETWEEN 0 AND 100),
  CHECK (jumping BETWEEN 0 AND 100),
  CHECK (stamina BETWEEN 0 AND 100),
  CHECK (strength BETWEEN 0 AND 100),
  CHECK (aggression BETWEEN 0 AND 100),
  CHECK (gk_diving IS NULL OR gk_diving BETWEEN 0 AND 100),
  CHECK (gk_handling IS NULL OR gk_handling BETWEEN 0 AND 100),
  CHECK (gk_kicking IS NULL OR gk_kicking BETWEEN 0 AND 100),
  CHECK (gk_positioning IS NULL OR gk_positioning BETWEEN 0 AND 100),
  CHECK (gk_reflexes IS NULL OR gk_reflexes BETWEEN 0 AND 100),
  CHECK (
    (position = 'GK' AND gk_diving IS NOT NULL AND gk_handling IS NOT NULL AND gk_kicking IS NOT NULL AND gk_positioning IS NOT NULL AND gk_reflexes IS NOT NULL)
    OR
    (position <> 'GK')
  )
);

CREATE TABLE fc25_squads (
  dataset_version_id TEXT NOT NULL,
  club_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  squad_role TEXT NOT NULL,
  shirt_number INTEGER,
  sort_order INTEGER NOT NULL,
  overall INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (dataset_version_id, club_id, player_id),
  FOREIGN KEY (dataset_version_id, club_id) REFERENCES fc25_clubs(dataset_version_id, id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_version_id, player_id) REFERENCES fc25_players(dataset_version_id, id) ON DELETE CASCADE,
  CHECK (squad_role IN ('starter', 'sub', 'reserve')),
  CHECK (shirt_number IS NULL OR shirt_number > 0),
  CHECK (sort_order >= 0),
  CHECK (overall BETWEEN 0 AND 100)
);

CREATE INDEX fc25_players_dataset_position_idx ON fc25_players(dataset_version_id, position);
CREATE INDEX fc25_squads_dataset_club_role_idx ON fc25_squads(dataset_version_id, club_id, squad_role, sort_order);
