# @the-ataturk/web

Vite + React frontend for The Atatürk.

## Local Admin

Run the app from the repo root:

```sh
pnpm dev
```

Open `http://127.0.0.1:5175/admin` for the local admin tool.

Open `http://127.0.0.1:5175/match` for the current text-only match playback slice. It is dev-quality only: the page streams a second-half Liverpool v Milan run from the local backend and is meant for engine validation, not final UI.

The admin is intentionally unauthenticated and localhost-only for now. It provides dense data tooling for clubs, squads, dataset versions, profile versions, manual player attribute edits, and player-profile curation.

Useful routes:

- `/admin/clubs`
- `/admin/dataset-versions`
- `/admin/profile-versions`
- `/admin/extract-profiles`
- `/admin/derive-attributes`

The profile extraction page calls the local backend, which calls Gemini using `GEMINI_API_KEY`. Each full run costs roughly $0.10-0.30 in API credits.

The attribute derivation page derives engine attributes from curated profiles into a non-stub dataset version. Each full run costs roughly $0.20-0.50 in API credits.
