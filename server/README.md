# @the-ataturk/server

Fastify backend for local development.

Useful admin endpoints:

- `GET /api/attribute-derivation/preflight?dataset_version=<id>&profile_version=<id>`
- `POST /api/attribute-derivation/run`
- `POST /api/profile-extraction/run`
- `GET /api/profile-versions`
- `GET /api/dataset-versions`

LLM endpoints are server-side only and read `GEMINI_API_KEY` from the environment.
