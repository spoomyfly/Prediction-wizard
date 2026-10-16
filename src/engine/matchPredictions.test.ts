import { describe, expect, it } from 'vitest'
import { MAX_TRACKED_GOALS, MatchStatsCollector, nextMatchday } from './matchPredictions'
import { simulate } from './simulate'
import type { CompetitionConfig, Fixture, FootballResult, Team } from './types'

function fixture(id: string, matchday: number, home: string, away: string): Fixture {
  return { id, matchday, homeTeamId: home, awayTeamId: away }
}

const fixtures: Fixture[] = [
  fixture('f1', 1, 'a', 'b'),
  fixture('f2', 1, 'c', 'd'),
  fixture('f3', 2, 'a', 'c'),
  fixture('f4', 2, 'b', 'd'),
]

describe('nextMatchday', () => {
  it('is the lowest matchday with anything left to play', () => {
    expect(nextMatchday(fixtures, new Set(['f1']))).toBe(1)
    expect(nextMatchday(fixtures, new Set(['f1', 'f2']))).toBe(2)
  })

  it('is undefined once every fixture has been played', () => {
    expect(nextMatchday(fixtures, new Set(['f1', 'f2', 'f3', 'f4']))).toBeUndefined()
  })
})

describe('MatchStatsCollector', () => {
  const played = new Set(['f1', 'f2'])

  function result(fixtureId: string, homeGoals: number, awayGoals: number): FootballResult {
    return { fixtureId, homeGoals, awayGoals }
  }

  it('tracks only the fixtures that have not been played', () => {
    const collector = new MatchStatsCollector(fixtures, played)
    expect(collector.trackedCount).toBe(2)

    collector.record([result('f1', 9, 0), result('f2', 9, 0), result('f3', 1, 0), result('f4', 0, 0)])
    const predictions = collector.finish()
    expect(predictions.map((p) => p.fixtureId)).toEqual(['f3', 'f4'])
  })

  it('turns recorded runs into probabilities that sum to one', () => {
    const collector = new MatchStatsCollector(fixtures, played)
    collector.record([result('f1', 0, 0), result('f2', 0, 0), result('f3', 2, 1), result('f4', 0, 0)])
    collector.record([result('f1', 0, 0), result('f2', 0, 0), result('f3', 2, 1), result('f4', 1, 2)])
    collector.record([result('f1', 0, 0), result('f2', 0, 0), result('f3', 0, 3), result('f4', 0, 0)])
    collector.record([result('f1', 0, 0), result('f2', 0, 0), result('f3', 1, 1), result('f4', 0, 0)])

    const [f3, f4] = collector.finish()

    expect(f3.homeWin).toBeCloseTo(0.5, 10)
    expect(f3.draw).toBeCloseTo(0.25, 10)
    expect(f3.awayWin).toBeCloseTo(0.25, 10)
    expect(f3.homeWin + f3.draw + f3.awayWin).toBeCloseTo(1, 10)
    expect(f3.expectedHomeGoals).toBeCloseTo((2 + 2 + 0 + 1) / 4, 10)
    expect(f3.expectedAwayGoals).toBeCloseTo((1 + 1 + 3 + 1) / 4, 10)
    expect(f3.topScorelines[0]).toEqual({ homeGoals: 2, awayGoals: 1, probability: 0.5 })

    expect(f4.topScorelines[0]).toEqual({ homeGoals: 0, awayGoals: 0, probability: 0.75 })
  })

  it('buckets very high scores into the top tracked bucket instead of dropping them', () => {
    const collector = new MatchStatsCollector(fixtures, played)
    collector.record([result('f1', 0, 0), result('f2', 0, 0), result('f3', 20, 0), result('f4', 0, 0)])
    const [f3] = collector.finish()

    expect(f3.homeWin).toBe(1)
    // The scoreline is clamped for display, but the goal average keeps the real number.
    expect(f3.topScorelines[0]).toEqual({
      homeGoals: MAX_TRACKED_GOALS,
      awayGoals: 0,
      probability: 1,
    })
    expect(f3.expectedHomeGoals).toBe(20)
  })

  it('returns nothing when no run was recorded', () => {
    expect(new MatchStatsCollector(fixtures, played).finish()).toEqual([])
  })
})

describe('simulate with collectMatchStats', () => {
  const config: CompetitionConfig = {
    id: 'test',
    name: 'Test',
    sport: 'football',
    season: '2026',
    format: { type: 'league-phase', matchesPerTeam: 2 },
    matchModel: 'poisson-goals',
    tiebreakers: ['goal-difference', 'goals-for'],
    zones: [{ id: 'top', label: 'Top', from: 1, to: 2, color: '#000' }],
    modelDefaults: { avgGoals: 1.4, homeAdv: 1.15, sigma: 0.1, rho: 0 },
  }

  const teams: Team[] = [
    { id: 'a', name: 'A', elo: 1900, attack: 1.3, defense: 0.8 },
    { id: 'b', name: 'B', elo: 1700, attack: 1.0, defense: 1.0 },
    { id: 'c', name: 'C', elo: 1600, attack: 0.9, defense: 1.1 },
    { id: 'd', name: 'D', elo: 1500, attack: 0.7, defense: 1.3 },
  ]

  const results: FootballResult[] = [{ fixtureId: 'f1', homeGoals: 2, awayGoals: 0 }]

  it('predicts only the unplayed fixtures, with probabilities summing to one', () => {
    const sim = simulate(config, teams, fixtures, results, 4000, {
      seed: 'match-stats',
      collectMatchStats: true,
    })

    expect(sim.matches).toBeDefined()
    expect(sim.matches!.map((m) => m.fixtureId)).toEqual(['f2', 'f3', 'f4'])
    for (const match of sim.matches!) {
      expect(match.homeWin + match.draw + match.awayWin).toBeCloseTo(1, 10)
      expect(match.topScorelines.length).toBeGreaterThan(0)
      expect(match.expectedHomeGoals).toBeGreaterThan(0)
    }
  })

  it('gives the stronger side the better odds', () => {
    const sim = simulate(config, teams, fixtures, results, 4000, {
      seed: 'match-stats',
      collectMatchStats: true,
    })
    // f3 is A (strongest, at home) against C.
    const f3 = sim.matches!.find((m) => m.fixtureId === 'f3')!
    expect(f3.homeWin).toBeGreaterThan(f3.awayWin)
  })

  it('is omitted unless asked for, and does not change the standings', () => {
    const plain = simulate(config, teams, fixtures, results, 2000, { seed: 'same' })
    const withStats = simulate(config, teams, fixtures, results, 2000, {
      seed: 'same',
      collectMatchStats: true,
    })

    expect(plain.matches).toBeUndefined()
    expect(withStats.teams.map((t) => t.positionCounts)).toEqual(
      plain.teams.map((t) => t.positionCounts),
    )
  })
})
