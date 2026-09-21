import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../rng'
import { eloWinProbability, sampleSeries } from './series'
import type { Team } from '../types'

describe('eloWinProbability', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(eloWinProbability(1500, 1500)).toBeCloseTo(0.5, 10)
  })

  it('favors the higher-rated side', () => {
    expect(eloWinProbability(1600, 1400)).toBeGreaterThan(0.5)
    expect(eloWinProbability(1400, 1600)).toBeLessThan(0.5)
  })
})

describe('sampleSeries', () => {
  const strong: Team = { id: 'a', name: 'A', elo: 1800 }
  const weak: Team = { id: 'b', name: 'B', elo: 1200 }

  it('Bo1 never produces a draw', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 200; i++) {
      const { homeMapWins, awayMapWins } = sampleSeries(rng, strong, weak, 1)
      expect(homeMapWins + awayMapWins).toBe(1)
      expect(homeMapWins === 1 || awayMapWins === 1).toBe(true)
    }
  })

  it('Bo2 can end in a 1-1 draw', () => {
    const rng = mulberry32(2)
    const outcomes = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const { homeMapWins, awayMapWins } = sampleSeries(rng, strong, weak, 2)
      outcomes.add(`${homeMapWins}-${awayMapWins}`)
    }
    expect(outcomes.has('1-1')).toBe(true)
  })

  it('Bo3 always ends 2-0 or 2-1', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const { homeMapWins, awayMapWins } = sampleSeries(rng, strong, weak, 3)
      const total = `${homeMapWins}-${awayMapWins}`
      expect(['2-0', '2-1', '1-2', '0-2']).toContain(total)
    }
  })

  it('Bo5 always ends with a side reaching 3 wins', () => {
    const rng = mulberry32(4)
    for (let i = 0; i < 200; i++) {
      const { homeMapWins, awayMapWins } = sampleSeries(rng, strong, weak, 5)
      expect(Math.max(homeMapWins, awayMapWins)).toBe(3)
    }
  })
})
