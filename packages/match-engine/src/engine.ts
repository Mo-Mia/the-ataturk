import { buildInitState } from "./state/initState";
import { buildSnapshot, emitFullTime, tickCount, toMatchTick } from "./snapshot";
import type { MatchConfig, MatchConfigV2, MatchSnapshot, MatchTick } from "./types";
import { runTick } from "./ticks/runTick";

/**
 * Run a deterministic match simulation and return the complete replay snapshot.
 *
 * @param config Match setup, teams, duration, seed, dynamics, and optional pre-match state.
 * @returns A full match snapshot containing ticks, final score, statistics, and diagnostics.
 * @throws If the supplied team/player configuration cannot build an initial match state.
 */
export function simulateMatch(config: MatchConfig): MatchSnapshot;
export function simulateMatch(config: MatchConfigV2): MatchSnapshot;
export function simulateMatch(config: MatchConfig | MatchConfigV2): MatchSnapshot;
export function simulateMatch(config: MatchConfig | MatchConfigV2): MatchSnapshot {
  const state = buildInitState(config);
  const ticks: MatchTick[] = [];
  const totalTicks = tickCount(config.duration);

  for (let count = 0; count < totalTicks; count += 1) {
    runTick(state);
    if (count === totalTicks - 1) {
      emitFullTime(state);
    }
    ticks.push(toMatchTick(state));
  }

  return buildSnapshot(state, config, ticks);
}

/**
 * Stream deterministic match ticks without materialising a full snapshot.
 *
 * @param config Match setup, teams, duration, seed, dynamics, and optional pre-match state.
 * @param options Optional abort signal for cancelling long-running streams.
 * @returns An async iterable yielding each simulated match tick in order.
 * @throws DOMException with name `AbortError` when the abort signal is triggered.
 */
export function simulateMatchStream(
  config: MatchConfig,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick>;
export function simulateMatchStream(
  config: MatchConfigV2,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick>;
export function simulateMatchStream(
  config: MatchConfig | MatchConfigV2,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick>;
export async function* simulateMatchStream(
  config: MatchConfig | MatchConfigV2,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick> {
  const state = buildInitState(config);
  const totalTicks = tickCount(config.duration);

  for (let count = 0; count < totalTicks; count += 1) {
    throwIfAborted(options?.signal);
    runTick(state);
    if (count === totalTicks - 1) {
      emitFullTime(state);
    }
    yield toMatchTick(state);
    await Promise.resolve();
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Match simulation aborted", "AbortError");
  }
}
