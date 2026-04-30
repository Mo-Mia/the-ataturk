import type { MatchConfig, MatchSnapshot, MatchTick } from "./types";

export function simulateMatch(config: MatchConfig): MatchSnapshot {
  throw new Error("Not implemented");
}

export async function* simulateMatchStream(
  config: MatchConfig,
  options?: { signal?: AbortSignal }
): AsyncIterable<MatchTick> {
  throw new Error("Not implemented");
}
