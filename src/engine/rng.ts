// Deterministic, fast, seedable PRNG (mulberry32). Not cryptographic —
// used only to make Monte Carlo simulation runs reproducible for a given seed.

export type RandomFn = () => number

export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Derive a 32-bit int seed from an arbitrary string, so callers can pass
// human-readable seeds (e.g. competition id + run index).
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h ^ (h >>> 16)) >>> 0
}

// Standard normal sample via Box-Muller, driven by the given RNG so it stays
// seed-reproducible.
export function randomNormal(rng: RandomFn, mean = 0, sigma = 1): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + z * sigma
}

// Sample from a Poisson distribution with mean lambda using Knuth's
// algorithm. Fine for the small lambdas (goals per match) used here.
export function randomPoisson(rng: RandomFn, lambda: number): number {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return k - 1
}
