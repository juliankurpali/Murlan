export type RandomSource = {
  /** Returns a float in [0, 1). */
  next: () => number;
};

/** Mulberry32 — deterministic, seedable source for tests and replay. */
export function createSeededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function mathRandomSource(): RandomSource {
  return { next: () => Math.random() };
}
