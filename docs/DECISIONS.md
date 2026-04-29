# Decision Log

Append-only. Newest at the top. Each entry: date, decision, rationale, alternatives considered.

---

## 2026-04-29 — Wrap, don't fork `footballsimulationengine`
Adopt as npm dependency, build typed adapter layer above. Aligned with upstream improvements; small enough to fork later if upstream goes dark. Rejected: forking immediately (permanent maintenance debt) and writing our own engine (huge scope, no payoff for v0.1).

## 2026-04-29 — Scope v0.1 to a single match (the 2005 CL final)
"Istanbul: The Game". One Liverpool vs Milan match, fully realised. If this match doesn't feel magical, the project doesn't continue. Rejected: full Liverpool campaign as v0.1 (too much scope before validating the magic moment).

## 2026-04-29 — Gemini 3 family for LLM, swappable TTS provider
Gemini 3 Flash for per-event commentary, Gemini 3.1 Pro for set-piece moments (pre-match, half-time, full-time, decisive moments). TTS provider abstraction from day one — Gemini TTS as default during dev, ElevenLabs as A/B comparison near v0.1 ship. Rejected: locking to a single TTS vendor early (voice quality is the sensory hook, worth treating as tunable).

## 2026-04-29 — Project name "The Atatürk", repo name `the-ataturk`
Display name with diacritic, repo without (cleaner, no encoding issues). Named after the Atatürk Olympic Stadium in Istanbul where the 2005 final was played.

## 2026-04-29 — Defer Vercel deployment until v0.1 demo time
Repo on day one (enables direct GitHub tooling, better than zip handoffs). Vercel deferred — Node backend with streaming + audio + game state has Vercel-specific gotchas worth thinking through with a working local app, not before.

## 2026-04-29 — Monorepo with workspaces
Clean separation of engine wrapper / tactics / commentary / TTS as packages. Useful for testing and (potential) reuse. Layout in `ARCHITECTURE.md`.
