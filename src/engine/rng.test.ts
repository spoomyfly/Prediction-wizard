import { describe, expect, it } from 'vitest'
import { mulberry32, randomPoisson } from './rng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('stays within [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randomPoisson', () => {
  it('has a sample mean close to lambda over many draws', () => {
    const rng = mulberry32(123)
    const lambda = 1.35
    const n = 20000
    let sum = 0
    for (let i = 0; i < n; i++) sum += randomPoisson(rng, lambda)
    const mean = sum / n
    expect(mean).toBeGreaterThan(lambda - 0.05)
    expect(mean).toBeLessThan(lambda + 0.05)
  })

  it('returns 0 for non-positive lambda', () => {
    const rng = mulberry32(1)
    expect(randomPoisson(rng, 0)).toBe(0)
    expect(randomPoisson(rng, -1)).toBe(0)
  })
})
