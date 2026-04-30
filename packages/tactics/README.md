# @the-ataturk/tactics

This package contains the tactical translation layer between game-level choices and the football simulation engine.

For this vertical slice it only translates supported formations into engine pitch coordinates. Future work will add mentality, tempo, pressing, and per-player role modifiers as described in [docs/ARCHITECTURE.md § Tactics layer](../../docs/ARCHITECTURE.md#tactics-layer-we-build-this).

Supported formations in this slice:

- `4-4-2`
- `4-3-1-2`
