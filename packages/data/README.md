# @the-ataturk/data

SQLite data layer for The Atatürk.

This package owns:

- Plain SQL migrations in `migrations/`
- Typed database access helpers in `src/`
- JSON seed loading from `../../data/seeds/`
- Phase A schema support for real players and future user-created players

The database is rebuilt from seed data with `pnpm db:reset` at the repo root.
