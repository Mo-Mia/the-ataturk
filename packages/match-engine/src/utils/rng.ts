export interface Rng {
  next(): number;
  int(minInclusive: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  }

  return {
    next,
    int(minInclusive, maxInclusive) {
      return Math.floor(next() * (maxInclusive - minInclusive + 1)) + minInclusive;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty array");
      }

      return items[Math.floor(next() * items.length)]!;
    }
  };
}
