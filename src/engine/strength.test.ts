import { describe, expect, it } from 'vitest'
import { prepareTeamStrengths, resolveTeamStrengths } from './strength'
import { defaultEloParams } from './elo'
import type { Fixture, FootballResult, Team } from './types'

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

function fixture(id: string, matchday: number, home: string, away: string): Fixture {
  return { id, matchday, homeTeamId: home, awayTeamId: away }
}

describe('prepareTeamStrengths', () => {
  it('treats a per-team Elo override as the BASELINE, not the final rating: results still replay on top', () => {
    const teams = makeTeams([1700, 1700])
    const fixtures = [fixture('f1', 1, 't0', 't1')]
    const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 3, awayGoals: 0 }]

    const { teams: prepared, eloStates } = prepareTeamStrengths(
      teams,
      fixtures,
      results,
      defaultEloParams,
      { ratingInfluence: 1, overrides: { t0: { elo: 2000 } } },
    )

    // Baseline is the override (2000), but currentElo has moved further after
    // the win — it must not just equal the raw override.
    expect(eloStates.get('t0')!.baseElo).toBe(2000)
    expect(eloStates.get('t0')!.currentElo).toBeGreaterThan(2000)
    expect(prepared.find((t) => t.id === 't0')!.elo).toBe(eloStates.get('t0')!.effectiveElo)
  })

  it('does not double-apply a manual adjustment through both the Elo baseline and resolveTeamStrengths', () => {
    const teams = makeTeams([1700, 1700])
    const fixtures: Fixture[] = []
    const results: FootballResult[] = []

    // adjustmentPct should only affect attack/defense (via resolveTeamStrengths),
    // never get folded into the Elo baseline that replayElo/applyEloStates sees.
    const { teams: prepared, eloStates } = prepareTeamStrengths(
      teams,
      fixtures,
      results,
      defaultEloParams,
      { ratingInfluence: 1, overrides: { t0: { adjustmentPct: 0.2 } } },
    )
    expect(eloStates.get('t0')!.baseElo).toBe(1700)
    const [boosted, plain] = prepared
    expect(boosted.attack!).toBeGreaterThan(plain.attack!)
  })

  it('carries a coach-change override through to a per-team sigma multiplier on the output teams', () => {
    const teams = makeTeams([1700, 1700])
    const fixtures = [fixture('f1', 1, 't0', 't1')]
    const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 0, awayGoals: 2 }]

    const { teams: prepared } = prepareTeamStrengths(teams, fixtures, results, defaultEloParams, {
      ratingInfluence: 1,
      overrides: { t0: { coachChangedBeforeMatchday: 1 } },
    })
    expect(prepared.find((t) => t.id === 't0')!.sigmaMultiplier).toBeGreaterThan(1)
    expect(prepared.find((t) => t.id === 't1')!.sigmaMultiplier ?? 1).toBe(1)
  })

  it('with no params at all, still replays Elo (current rating differs from baseline after a result)', () => {
    const teams = makeTeams([1700, 1700])
    const fixtures = [fixture('f1', 1, 't0', 't1')]
    const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 2, awayGoals: 0 }]

    const { eloStates } = prepareTeamStrengths(teams, fixtures, results, defaultEloParams, undefined)
    expect(eloStates.get('t0')!.currentElo).toBeGreaterThan(1700)
  })
})
