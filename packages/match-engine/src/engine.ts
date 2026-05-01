import { buildInitState } from "./state/initState";
import { buildSnapshot, emitFullTime, tickCount, toMatchTick } from "./snapshot";
import type { MatchConfig, MatchConfigV2, MatchSnapshot, MatchTick } from "./types";
import { runTick } from "./ticks/runTick";

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
