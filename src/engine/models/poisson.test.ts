import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../rng'
import { expectedGoals, sampleFootballScore } from './poisson'
import type { Team } from '../types'

const home: Team = { id: 'home', name: 'Home', attack: 1.2, defense: 0.9 }
const away: Team = { id: 'away', name: 'Away', attack: 0.8, defense: 1.1 }

describe('expectedGoals', () => {
  it('computes lambda_home and lambda_away from the poisson formula', () => {
    const { lambdaHome, lambdaAway } = expectedGoals(home, away, {
      avgGoals: 1.4,
      homeAdv: 1.2,
    })
    // lambda_home = avg * att_home * def_away * sqrt(homeAdv)
    expect(lambdaHome).toBeCloseTo(1.4 * 1.2 * 1.1 * Math.sqrt(1.2), 10)
    // lambda_away = avg * att_away * def_home / sqrt(homeAdv)
    expect(lambdaAway).toBeCloseTo((1.4 * 0.8 * 0.9) / Math.sqrt(1.2), 10)
  })

  it('keeps total expected goals unchanged as homeAdv moves (symmetric split)', () => {
    // With home and away swapped-in as equal-strength teams, lambdaHome *
    // lambdaAway should stay constant across homeAdv values — only the
    // home/away balance should shift, not the aggregate.
    const even: Team = { id: 'even', name: 'Even', attack: 1, defense: 1 }
    const low = expectedGoals(even, even, { avgGoals: 1.4, homeAdv: 1.0 })
    const high = expectedGoals(even, even, { avgGoals: 1.4, homeAdv: 1.3 })
    expect(low.lambdaHome * low.lambdaAway).toBeCloseTo(high.lambdaHome * high.lambdaAway, 10)
    expect(high.lambdaHome).toBeGreaterThan(low.lambdaHome)
    expect(high.lambdaAway).toBeLessThan(low.lambdaAway)
  })
})

describe('sampleFootballScore', () => {
  it('has sample-mean goals close to the expected lambdas', () => {
    const rng = mulberry32(99)
    const defaults = { avgGoals: 1.35, homeAdv: 1.15 }
    const { lambdaHome, lambdaAway } = expectedGoals(home, away, defaults)

    let homeSum = 0
    let awaySum = 0
    const n = 20000
    for (let i = 0; i < n; i++) {
      const { homeGoals, awayGoals } = sampleFootballScore(rng, home, away, defaults)
      homeSum += homeGoals
      awaySum += awayGoals
    }

    expect(homeSum / n).toBeGreaterThan(lambdaHome - 0.05)
    expect(homeSum / n).toBeLessThan(lambdaHome + 0.05)
    expect(awaySum / n).toBeGreaterThan(lambdaAway - 0.05)
    expect(awaySum / n).toBeLessThan(lambdaAway + 0.05)
  })

  it('is deterministic for a given seed', () => {
    const defaults = { avgGoals: 1.35, homeAdv: 1.15 }
    const rngA = mulberry32(555)
    const rngB = mulberry32(555)
    const a = Array.from({ length: 50 }, () => sampleFootballScore(rngA, home, away, defaults))
    const b = Array.from({ length: 50 }, () => sampleFootballScore(rngB, home, away, defaults))
    expect(a).toEqual(b)
  })
})
