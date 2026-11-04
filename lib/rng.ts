/**
 * Small seeded PRNG (mulberry32). Deterministic for a given seed so
 * choreographies and identities can be replayed and tested.
 */
export type Rng = {
  next: () => number;
  int: (min: number, maxInclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
};

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min: number, maxInclusive: number) {
    return min + Math.floor(next() * (maxInclusive - min + 1));
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick() on empty list");
    return items[int(0, items.length - 1)];
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  return { next, int, pick, shuffle };
}

export function randomSeed(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}
