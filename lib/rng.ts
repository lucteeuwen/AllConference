/**
 * Deterministic pseudo-random helpers.
 *
 * The dummy dataset is generated rather than hand-typed, but it must be stable:
 * the same seed always yields the same roster, score and lineup so that server
 * and client render identically and standings never shift between reloads.
 */

function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rng = {
  /** Float in [0, 1). */
  next: () => number;
  /** Integer in [min, max]. */
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  /** Returns a new shuffled copy. */
  shuffle: <T>(items: readonly T[]) => T[];
  /** True with the given probability. */
  chance: (probability: number) => boolean;
};

export function createRng(seed: string): Rng {
  let a = hashString(seed);

  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));

  const pick = <T,>(items: readonly T[]) => items[int(0, items.length - 1)];

  const shuffle = <T,>(items: readonly T[]) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const chance = (probability: number) => next() < probability;

  return { next, int, pick, shuffle, chance };
}
