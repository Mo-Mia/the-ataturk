# Data Seeds

These JSON files are the authoritative v0.1 seed source. The SQLite database is rebuilt from them with `pnpm db:reset`.

Liverpool's seed includes the 26 players in the research document who made at least one Champions League appearance in 2004/05. Fernando Morientes and Mauricio Pellegrino are intentionally omitted because the research document notes they were European-ineligible after January moves, so the seeded players all default to `is_eligible_european=true`.

The 2005 final fixture uses Liverpool as `home_club_id` and AC Milan as `away_club_id` for editorial display order. The match was at the neutral Atatürk Olympic Stadium, so neither side was home in the conventional league-fixture sense.
