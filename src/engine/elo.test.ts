import { describe, expect, it } from 'vitest'
import {
  applyEloStates,
  defaultEloParams,
  expectedScore,
  goalDifferenceMultiplier,
  replayElo,
} from './elo'
import type { EloParams } from './elo'
import type { Fixture, FootballResult, Team } from './types'

const params: EloParams = { ...defaultEloParams }

function makeTeams(): Team[] {
  return [
    { id: 'a', name: 'A', elo: 1800 },
    { id: 'b', name: 'B', elo: 1800 },
    { id: 'c', name: 'C', elo: 1500 },
    { id: 'd', name: 'D', elo: 1500 },
  ]
}

function fixture(id: string, matchday: number, home: string, away: string): Fixture {
  return { id, matchday, homeTeamId: home, awayTeamId: away }
}

describe('expectedScore', () => {
  it('is 0.5 for equal ratings with no home advantage', () => {
    expect(expectedScore(1800, 1800, 0)).toBeCloseTo(0.5, 10)
  })

  it('favors the home side once home advantage is applied', () => {
    expect(expectedScore(1800, 1800, 70)).toBeGreaterThan(0.5)
  })

  it('favors the stronger team', () => {
    expect(expectedScore(2000, 1500, 0)).toBeGreaterThan(0.9)
  })
})

describe('goalDifferenceMultiplier', () => {
  it('leaves one-goal margins and draws unscaled', () => {
    expect(goalDifferenceMultiplier(0)).toBe(1)
    expect(goalDifferenceMultiplier(1)).toBe(1)
    expect(goalDifferenceMultiplier(-1)).toBe(1)
  })

  it('grows with the margin', () => {
    expect(goalDifferenceMultiplier(2)).toBeGreaterThan(goalDifferenceMultiplier(1))
    expect(goalDifferenceMultiplier(5)).toBeGreaterThan(goalDifferenceMultiplier(3))
  })

  it('is symmetric in the sign of the margin', () => {
    expect(goalDifferenceMultiplier(4)).toBe(goalDifferenceMultiplier(-4))
  })
})

describe('replayElo', () => {
  it('leaves ratings at baseline when nothing has been played', () => {
    const states = replayElo(makeTeams(), [], [], params)
    for (const state of states.values()) {
      expect(state.currentElo).toBe(state.baseElo)
      expect(state.matchesPlayed).toBe(0)
      expect(state.form).toBe(0)
    }
  })

  it('moves the winner up and the loser down', () => {
    const fixtures = [fixture('f1', 1, 'a', 'b')]
    const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 2, awayGoals: 0 }]
    const states = replayElo(makeTeams(), fixtures, results, params)
    expect(states.get('a')!.currentElo).toBeGreaterThan(1800)
    expect(states.get('b')!.currentElo).toBeLessThan(1800)
  })

  it('is zero-sum between the two sides when neither changed coach', () => {
    const fixtures = [fixture('f1', 1, 'a', 'b')]
    const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 1, awayGoals: 0 }]
    const states = replayElo(makeTeams(), fixtures, results, params)
    const deltaA = states.get('a')!.currentElo - 1800
    const deltaB = states.get('b')!.currentElo - 1800
    expect(deltaA + deltaB).toBeCloseTo(0, 10)
  })

  it('moves an underdog further for the same win than a favorite', () => {
    const fixtures = [fixture('f1', 1, 'c', 'a'), fixture('f2', 1, 'a', 'c')]
    const underdogWins = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 1, awayGoals: 0 },
    ], params)
    const favoriteWins = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f2', homeGoals: 1, awayGoals: 0 },
    ], params)
    const underdogGain = underdogWins.get('c')!.currentElo - 1500
    const favoriteGain = favoriteWins.get('a')!.currentElo - 1800
    expect(underdogGain).toBeGreaterThan(favoriteGain)
  })

  it('moves ratings further for a bigger margin of victory', () => {
    const fixtures = [fixture('f1', 1, 'a', 'b')]
    const narrow = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 1, awayGoals: 0 },
    ], params)
    const rout = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 5, awayGoals: 0 },
    ], params)
    expect(rout.get('a')!.currentElo).toBeGreaterThan(narrow.get('a')!.currentElo)
  })

  it('is deterministic and idempotent for the same inputs', () => {
    const fixtures = [fixture('f1', 1, 'a', 'b'), fixture('f2', 2, 'c', 'a')]
    const results: FootballResult[] = [
      { fixtureId: 'f1', homeGoals: 2, awayGoals: 1 },
      { fixtureId: 'f2', homeGoals: 0, awayGoals: 3 },
    ]
    const first = replayElo(makeTeams(), fixtures, results, params)
    const second = replayElo(makeTeams(), fixtures, results, params)
    for (const [id, state] of first) {
      expect(second.get(id)!.currentElo).toBe(state.currentElo)
    }
  })

  it('ignores results whose fixture is unknown instead of throwing', () => {
    const states = replayElo(makeTeams(), [fixture('f1', 1, 'a', 'b')], [
      { fixtureId: 'ghost', homeGoals: 3, awayGoals: 0 },
    ], params)
    expect(states.get('a')!.matchesPlayed).toBe(0)
  })
})

describe('coach change', () => {
  const fixtures = [fixture('f1', 1, 'a', 'b')]
  const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 0, awayGoals: 1 }]

  it('moves the rating further for the team with a fresh coach', () => {
    const baseline = replayElo(makeTeams(), fixtures, results, params)
    const withChange = replayElo(
      makeTeams().map((t) => (t.id === 'a' ? { ...t, coachChangedBeforeMatchday: 1 } : t)),
      fixtures,
      results,
      params,
    )
    const baselineDrop = 1800 - baseline.get('a')!.currentElo
    const boostedDrop = 1800 - withChange.get('a')!.currentElo
    expect(boostedDrop).toBeGreaterThan(baselineDrop)
  })

  it('leaves the opponent untouched by the other side coach change', () => {
    const baseline = replayElo(makeTeams(), fixtures, results, params)
    const withChange = replayElo(
      makeTeams().map((t) => (t.id === 'a' ? { ...t, coachChangedBeforeMatchday: 1 } : t)),
      fixtures,
      results,
      params,
    )
    expect(withChange.get('b')!.currentElo).toBeCloseTo(baseline.get('b')!.currentElo, 10)
  })

  it('raises that team simulation noise and leaves everyone else at 1', () => {
    const states = replayElo(
      makeTeams().map((t) => (t.id === 'a' ? { ...t, coachChangedBeforeMatchday: 1 } : t)),
      fixtures,
      results,
      params,
    )
    expect(states.get('a')!.sigmaMultiplier).toBeGreaterThan(1)
    expect(states.get('b')!.sigmaMultiplier).toBe(1)
  })

  it('decays the boost as matches under the new coach accumulate', () => {
    const manyFixtures = [
      fixture('f1', 1, 'a', 'b'),
      fixture('f2', 2, 'a', 'c'),
      fixture('f3', 3, 'a', 'd'),
      fixture('f4', 4, 'a', 'b'),
      fixture('f5', 5, 'a', 'c'),
      fixture('f6', 6, 'a', 'd'),
    ]
    const manyResults: FootballResult[] = manyFixtures.map((f) => ({
      fixtureId: f.id,
      homeGoals: 1,
      awayGoals: 1,
    }))
    const teams = makeTeams().map((t) => (t.id === 'a' ? { ...t, coachChangedBeforeMatchday: 1 } : t))
    const afterOne = replayElo(teams, manyFixtures.slice(0, 1), manyResults.slice(0, 1), params)
    const afterSix = replayElo(teams, manyFixtures, manyResults, params)
    expect(afterSix.get('a')!.sigmaMultiplier).toBeLessThan(afterOne.get('a')!.sigmaMultiplier)
    expect(afterSix.get('a')!.sigmaMultiplier).toBeGreaterThan(1)
  })

  it('treats a change announced for a future matchday as brand new', () => {
    const teams = makeTeams().map((t) => (t.id === 'a' ? { ...t, coachChangedBeforeMatchday: 7 } : t))
    const states = replayElo(teams, fixtures, results, params)
    expect(states.get('a')!.matchesSinceCoachChange).toBe(0)
    expect(states.get('a')!.sigmaMultiplier).toBeCloseTo(1 + params.coachSigmaBoost, 10)
  })
})

describe('form', () => {
  // 'a' (1800) hosting 'd' (1500) three times: winning every time is roughly
  // what Elo already expects, so form should stay near zero rather than
  // double-counting those wins on top of the rating.
  const fixtures = [
    fixture('f1', 1, 'a', 'd'),
    fixture('f2', 2, 'a', 'd'),
    fixture('f3', 3, 'a', 'd'),
  ]

  it('stays unknown (0) below the minimum number of matches', () => {
    const states = replayElo(makeTeams(), fixtures.slice(0, 2), [
      { fixtureId: 'f1', homeGoals: 3, awayGoals: 0 },
      { fixtureId: 'f2', homeGoals: 3, awayGoals: 0 },
    ], params)
    expect(states.get('a')!.form).toBe(0)
    expect(states.get('a')!.formElo).toBe(0)
  })

  it('is near zero for a favorite that merely wins as expected', () => {
    const states = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 1, awayGoals: 0 },
      { fixtureId: 'f2', homeGoals: 1, awayGoals: 0 },
      { fixtureId: 'f3', homeGoals: 1, awayGoals: 0 },
    ], params)
    expect(Math.abs(states.get('a')!.form)).toBeLessThan(0.2)
  })

  it('goes negative for a favorite that keeps dropping points', () => {
    const states = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 0, awayGoals: 1 },
      { fixtureId: 'f2', homeGoals: 1, awayGoals: 1 },
      { fixtureId: 'f3', homeGoals: 0, awayGoals: 2 },
    ], params)
    const state = states.get('a')!
    expect(state.form).toBeLessThan(0)
    expect(state.effectiveElo).toBeLessThan(state.currentElo)
  })

  it('goes positive for an underdog that keeps beating expectation', () => {
    const states = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 0, awayGoals: 1 },
      { fixtureId: 'f2', homeGoals: 0, awayGoals: 2 },
      { fixtureId: 'f3', homeGoals: 1, awayGoals: 3 },
    ], params)
    const state = states.get('d')!
    expect(state.form).toBeGreaterThan(0)
    expect(state.effectiveElo).toBeGreaterThan(state.currentElo)
  })

  it('weights the most recent match more heavily than older ones', () => {
    const recentSlump = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 3, awayGoals: 0 },
      { fixtureId: 'f2', homeGoals: 3, awayGoals: 0 },
      { fixtureId: 'f3', homeGoals: 0, awayGoals: 3 },
    ], params)
    const earlySlump = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 0, awayGoals: 3 },
      { fixtureId: 'f2', homeGoals: 3, awayGoals: 0 },
      { fixtureId: 'f3', homeGoals: 3, awayGoals: 0 },
    ], params)
    expect(recentSlump.get('a')!.form).toBeLessThan(earlySlump.get('a')!.form)
  })

  it('is disabled entirely when formWeight is 0', () => {
    const states = replayElo(makeTeams(), fixtures, [
      { fixtureId: 'f1', homeGoals: 0, awayGoals: 1 },
      { fixtureId: 'f2', homeGoals: 0, awayGoals: 2 },
      { fixtureId: 'f3', homeGoals: 0, awayGoals: 1 },
    ], { ...params, formWeight: 0 })
    const state = states.get('a')!
    expect(state.formElo).toBe(0)
    expect(state.effectiveElo).toBe(state.currentElo)
  })
})

describe('applyEloStates', () => {
  it('writes the form-adjusted rating and noise multiplier back onto the teams', () => {
    const teams = makeTeams().map((t) => (t.id === 'a' ? { ...t, coachChangedBeforeMatchday: 1 } : t))
    const states = replayElo(teams, [fixture('f1', 1, 'a', 'b')], [
      { fixtureId: 'f1', homeGoals: 0, awayGoals: 2 },
    ], params)
    const applied = applyEloStates(teams, states)
    const a = applied.find((t) => t.id === 'a')!
    expect(a.elo).toBeCloseTo(states.get('a')!.effectiveElo, 10)
    expect(a.sigmaMultiplier).toBeGreaterThan(1)
  })
})
