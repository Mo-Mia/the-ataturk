# @the-ataturk/data

SQLite data layer for The Atatürk.

This package owns:

- Plain SQL migrations in `migrations/`
- Typed database access helpers in `src/`
- JSON seed loading from `../../data/seeds/`
- Phase A schema support for real players and future user-created players
- FC25 five-club import support for the FootSim workbench

The database is rebuilt from seed data with `pnpm db:reset` at the repo root.

## FC25 Import

The FootSim workbench uses additive `fc25_*` tables in the existing SQLite
database. Imports are versioned; a successful run creates a new
`fc25_dataset_versions` row and activates it without mutating older versions.

The default source path is the local full export:

```sh
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/male_players.csv
```

The full CSV is intentionally ignored. Tests and portable smoke imports use the
tracked five-club fixture:

```sh
pnpm --filter @the-ataturk/data fc25:import -- --csv data/fc-25/fixtures/male_players_top5pl.csv
```

Phase 1 is deliberately limited to Arsenal, Manchester City, Manchester United,
Liverpool, and Aston Villa. Starter XIs are formation-neutral and locked at
ingest; formation-aware squad selection is deferred.
