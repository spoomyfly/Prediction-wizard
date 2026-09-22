import { describe, expect, it } from 'vitest'
import { resolveTeamStrengths } from './strength'
import type { Team } from './types'

function makeTeams(elos: number[]): Team[] {
  return elos.map((elo, i) => ({ id: `t${i}`, name: `Team ${i}`, elo }))
}

describe('resolveTeamStrengths', () => {
  it('returns teams unchanged when params is undefined', () => {
    const teams = makeTeams([1500, 1800])
    expect(resolveTeamStrengths(teams, undefined)).toBe(teams)
  })

  it('collapses every team to attack=defense=1 when ratingInfluence is 0', () => {
    const teams = makeTeams([1400, 1700, 2000])
    const resolved = resolveTeamStrengths(teams, { ratingInfluence: 0 })
    for (const team of resolved) {
      expect(team.attack).toBeCloseTo(1, 10)
      expect(team.defense).toBeCloseTo(1, 10)
    }
  })

  it('gives the higher-Elo team more attack and less defense than the lower one', () => {
    const teams = makeTeams([1500, 1900])
    const [weak, strong] = resolveTeamStrengths(teams, { ratingInfluence: 1 })
    expect(strong.attack!).toBeGreaterThan(weak.attack!)
    expect(strong.defense!).toBeLessThan(weak.defense!)
  })

  it('normalizes attack and defense to a field-wide mean of 1.0', () => {
    const teams = makeTeams([1400, 1650, 1900, 2100])
    const resolved = resolveTeamStrengths(teams, { ratingInfluence: 1.5 })
    const meanAttack = resolved.reduce((s, t) => s + t.attack!, 0) / resolved.length
    const meanDefense = resolved.reduce((s, t) => s + t.defense!, 0) / resolved.length
    expect(meanAttack).toBeCloseTo(1, 6)
    expect(meanDefense).toBeCloseTo(1, 6)
  })

  it('a positive manual adjustment boosts attack and lowers defense for that team only', () => {
    const teams = makeTeams([1700, 1700])
    const withAdjustment = resolveTeamStrengths(teams, {
      ratingInfluence: 1,
      overrides: { t0: { adjustmentPct: 0.2 } },
    })
    const [boosted, plain] = withAdjustment
    expect(boosted.attack!).toBeGreaterThan(plain.attack!)
    expect(boosted.defense!).toBeLessThan(plain.defense!)
  })

  it('an Elo override replaces the team base Elo for the strength calculation', () => {
    const teams = makeTeams([1700, 1700])
    const baseline = resolveTeamStrengths(teams, { ratingInfluence: 1 })
    const overridden = resolveTeamStrengths(teams, {
      ratingInfluence: 1,
      overrides: { t0: { elo: 2100 } },
    })
    expect(overridden[0].elo).toBe(2100)
    // t0 got stronger relative to baseline once its Elo override pulls the mean up.
    expect(overridden[0].attack!).toBeGreaterThan(baseline[0].attack!)
  })

  it('leaves teams with no known Elo (own or override) untouched', () => {
    const teams: Team[] = [{ id: 'noelo', name: 'No Elo' }]
    const resolved = resolveTeamStrengths(teams, { ratingInfluence: 1 })
    expect(resolved[0].attack).toBeUndefined()
    expect(resolved[0].defense).toBeUndefined()
  })

  it('clamps extreme adjustments instead of producing negative or runaway multipliers', () => {
    const teams = makeTeams([1200, 2400])
    const resolved = resolveTeamStrengths(teams, {
      ratingInfluence: 2,
      overrides: { t0: { adjustmentPct: -0.9 } },
    })
    for (const team of resolved) {
      expect(team.attack!).toBeGreaterThan(0)
      expect(team.defense!).toBeGreaterThan(0)
    }
  })
})
