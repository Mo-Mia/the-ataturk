# @the-ataturk/match-engine

Standalone TypeScript match engine used for calibration and snapshot replay work.

## Player Attribute Schemas

The engine accepts both the original v1 `PlayerInput` schema and the richer v2
`PlayerInputV2` schema.

- v1 inputs continue to drive the calibrated engine directly.
- v2 inputs are adapted to v1 internally through `adaptV2ToV1`.
- v2 metadata is preserved on snapshot rosters for future commentary, stats and
  UI consumers.
- Preferred foot and weak-foot rating are the only v2 fields that currently
  affect match behaviour.

`gkKicking` and `skillMovesRating` are intentionally preserved but not consumed
by the v0.1 bridge engine.

## Characterisation

```sh
pnpm --filter @the-ataturk/match-engine characterise -- --seeds 50
pnpm --filter @the-ataturk/match-engine characterise -- --seeds 50 --schema v2 --preferred-foot-mode either
pnpm --filter @the-ataturk/match-engine characterise -- --seeds 50 --schema v2 --preferred-foot-mode rated
```
