# Engine Integration Map

This document maps the integration surface between the `the-ataturk` codebase and the external `footballsimulationengine` (via our `@the-ataturk/engine` adapter). Investigation only; no code changes.

## 1. Engine API Surface

The engine itself is untyped JavaScript, so our `types.ts` defines its required shapes natively. The actual code dependencies are extremely concentrated.

**Direct Call Boundary (`packages/engine/src/engine/adapter.ts`)**
- `initiateGame(team1, team2, pitch)`: initial setup.
- `playIteration(matchDetails)`: advances the match by one tick.
- `startSecondHalf(matchDetails)`: mutates team sides and intents.

**Types Relied Upon (`packages/engine/src/engine/types.ts`)**
- `MatchDetails`: The god-object carrying `ball` state, `kickOffTeam`, `secondTeam`, `iterationLog`, and complex `*TeamStatistics`.
- `TeamInput` / `Team`: Nested player structures.
- `Player` / `PlayerInput`: Requires properties like `originPOS`, `intentPOS`, `currentPOS`, `hasBall`, `injured`, `stats` object, and a 10-attribute `skill` tree.
- `Ball`: Requires `[x,y,z]` position, `withTeam`, and `lastTouch` properties.

## 2. Dependencies by Module

Below is a breakdown of how our various modules depend on the engine. 

*(A = Adapter-Shaped, B = Type-Leaked, C = Behaviour-Dependent)*

* **`packages/engine/src/engine/adapter.ts`** — **B) TYPE-LEAKED**
  The only file that physically `require()`s the `footballsimulationengine` module.

* **`packages/engine/src/engine/types.ts`** — **A) ADAPTER-SHAPED**
  Defines the shapes of the adapter output. However, it deeply models the *exact* idiosyncratic shapes of `footballsimulationengine` internals (e.g. `ballOverIterations`). 

* **`packages/engine/test/match-smoke.test.ts`** — **C) BEHAVIOUR-DEPENDENT**
  Runs assertions assuming exact engine output behaviors—specifically that the match will not crash if iterated 900 times, and testing deep inside `matchDetails` (e.g. `hasAnyNonZeroStatistic`, `shotCount(...)`).

* **`packages/tactics/src/*`** — **A) ADAPTER-SHAPED**
  It strictly assigns our `Coordinate2D` to a template and returns it. Clean pure function.

* **`server/src/match/half-time-state.ts`** — **C) BEHAVIOUR-DEPENDENT**
  Heavily dependent on engine internal structure. It reaches in and mutates the engine string formats (`"GK"`, `"RB"`), forces the ball position onto the 9th and 10th index players explicitly `matchDetails.ball = { position: [340, 525, 0], withPlayer: true ... }`, and arbitrarily overwrites `currentPOS` and `intentPOS`. A custom engine must mirror the exact object mutation pathways or this entire file will break.

* **`server/src/match/orchestrator.ts`** — **C) BEHAVIOUR-DEPENDENT**
  Relies on a clock assumption structure (`iteration * 6 seconds = MatchClock`), relying on `playIteration` to advance match state in predictably discrete bites without skipping. 

* **`server/src/match/events.ts`** — **C) BEHAVIOUR-DEPENDENT**
  Extracts semantic events entirely by *diffing* the engine's internal statistics object between two iterations (`tackles.fouls`, `shots.on`). If a custom engine tracks statistics differently (or prefers to emit events natively instead of forcing a diff), this layer needs to change.

* **`server/src/match/run-smoke-match.ts`** — **A) ADAPTER-SHAPED**
  Uses the standard iterator and copies out `iterationLog` arrays.

* **`server/src/match/characterise.ts`** — **C) BEHAVIOUR-DEPENDENT**
  Just like the first-half builder, this reaches deep into the engine's nested values to forcefully mutate data. E.g. mutates Milan tackling via `p.skill.tackling = ...` and modifies intents manually.

* **`server/src/routes/match.ts`** — **A) ADAPTER-SHAPED**
  Just binds the `iterateMatch` orchestrator output to SSE. Perfectly insulated.

* **`apps/web/src/match/*`** — **A) ADAPTER-SHAPED**
  Redefines its own interface shapes locally to accept `MatchTick` and parses the SSE payloads. Zero coupling directly to engine source.

## 3. Engine Behaviours We Depend On

Beyond the TypeScript shapes, our codebase strictly assumes:
- **Tick Pacing:** 1 iteration = 6 seconds of match flow. Total iterations = 450 per half.
- **Diff-Based Event Generation:** We assume the engine accumulates actions in sub-components tracking Player and Team statistics (e.g., `shots`, `fouls`, `cards.yellow`). We detect action by extracting math deltas between iteration state `n` and `n-1`.
- **Positional Mapping:** We rely on the coordinate scaling being defined within exactly `680 x 1050`. Players use `originPOS`, `intentPOS`, and `currentPOS` independently per-iteration to establish intent vs current reality.
- **Log generation:** The `iterationLog` array string list is assumed to exist on the object, though mostly used for smoke-testing logging.

## 4. Migration Checklist

If replacing `footballsimulationengine` with a custom TypeScript equivalent, the surface modifications needed are:

1. **`packages/engine/src/engine/adapter.ts` (Trivial)**
   Re-export custom engine endpoints directly.
2. **`packages/engine/src/engine/types.ts` (Medium)**
   Retain the God-Object `MatchDetails` format purely to appease our downstream types, or cleanly redefine a new `CustomMatchState` and update downstream typings across the repo.
3. **`server/src/match/half-time-state.ts` (Large)**
   The `buildHalfTimeMatchState` file forcibly shoves object references around to simulate halfway start metrics. If custom engine logic takes inputs differently, this injection has to be thoroughly rewritten.
4. **`server/src/match/events.ts` (Large)**
   Needs massive rewrite if the Custom Engine decides to just spit out a flat `Event[]` array directly per tick rather than forcing us to diff a `PlayerStats` nested object every iteration.
5. **`server/src/match/characterise.ts` (Medium)**
   The mutation experiments directly alter `player.skill.tackling`. If your new engine uses a different skill tree/property, adjust this script.
6. **`packages/engine/test/match-smoke.test.ts` (Small)**
   Update the exact `shotCount` expect limits if the new baseline stochastic probabilities significantly differ from the current engine output.

## 5. The Adapter Contract

The current adapter specification that a new engine must implement:
```typescript
interface FootballSimulationEngineModule {
  initiateGame(team1: TeamInput, team2: TeamInput, pitch: Pitch): Promise<MatchDetails>;
  playIteration(matchDetails: MatchDetails): Promise<MatchDetails>;
  startSecondHalf(matchDetails: MatchDetails): Promise<MatchDetails>;
}
```

The underlying behavioural contract asks any returning engine to:
- Take 11 players across `team1` and `team2`.
- Store the resultant match universe in a statefully mutable `MatchDetails` object.
- Increment counters across `kickOffTeamStatistics` and `stats` fields on each player as things like goals or fouls happen during the return of `playIteration`.
- Produce positional output tracking `x` and `y` logic matching standard grid patterns (`0 > pitchWidth`, `0 > pitchHeight`).
