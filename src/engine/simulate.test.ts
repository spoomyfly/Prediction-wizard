import { describe, expect, it } from 'vitest'
import { simulate } from './simulate'
import { buildLeaguePhaseFixtures } from './fixtureGenerator'
import type { CompetitionConfig, Team } from './types'

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `team-${i}`,
    name: `Team ${i}`,
    attack: 0.7 + (i % 10) * 0.06,
    defense: 0.7 + ((n - i) % 10) * 0.06,
  }))
}

function makeConfig(id: string, matchesPerTeam: number): CompetitionConfig {
  return {
    id,
    name: id,
    sport: 'football',
    season: '2026/27',
    format: { type: 'league-phase', matchesPerTeam },
    matchModel: 'poisson-goals',
    tiebreakers: [
      'goal-difference',
      'goals-for',
      'away-goals',
      'wins',
      'away-wins',
      'opponents-points-sum',
      'opponents-goal-difference-sum',
      'opponents-goals-for-sum',
      'disciplinary-points',
      'club-coefficient',
    ],
    zones: [
      { id: 'ro16', label: '1/8', from: 1, to: 8, color: '#000' },
      { id: 'playoff', label: 'Play-off', from: 9, to: 24, color: '#111' },
      { id: 'out', label: 'Out', from: 25, to: 36, color: '#222' },
    ],
    modelDefaults: { avgGoals: 1.35, homeAdv: 1.15, sigma: 0.1 },
  }
}

describe('simulate (league phase)', () => {
  it('is deterministic for a given seed', () => {
    const teams = makeTeams(18)
    const config = makeConfig('det-test', 6)
    const fixtures = buildLeaguePhaseFixtures(teams.map((t) => t.id), 6, 'det')

    const a = simulate(config, teams, fixtures, [], 500, { seed: 'fixed-seed' })
    const b = simulate(config, teams, fixtures, [], 500, { seed: 'fixed-seed' })

    expect(a.teams.map((t) => t.positionCounts)).toEqual(b.teams.map((t) => t.positionCounts))
    expect(a.teams.map((t) => t.expectedPoints)).toEqual(b.teams.map((t) => t.expectedPoints))
  })

  it('gives each team a position-probability distribution that sums to 1', () => {
    const teams = makeTeams(12)
    const config = makeConfig('sum-test', 5)
    const fixtures = buildLeaguePhaseFixtures(teams.map((t) => t.id), 5, 'sum')

    const result = simulate(config, teams, fixtures, [], 800, { seed: 42 })

    for (const teamResult of result.teams) {
      const totalRuns = teamResult.positionCounts.reduce((s, c) => s + c, 0)
      expect(totalRuns).toBe(800)

      const zoneSum = Object.values(teamResult.zoneProbabilities).reduce((s, p) => s + p, 0)
      expect(zoneSum).toBeCloseTo(1, 10)
    }
  })

  it('does not re-simulate fixtures that already have a result', () => {
    const teams = makeTeams(4)
    const config = makeConfig('played-test', 3)
    const fixtures = buildLeaguePhaseFixtures(teams.map((t) => t.id), 3, 'played')
    // Force a lopsided already-played result for the first fixture.
    const played = [{ fixtureId: fixtures[0].id, homeGoals: 9, awayGoals: 0 }]

    const result = simulate(config, teams, fixtures, played, 300, { seed: 1 })
    const homeTeam = result.teams.find((t) => t.teamId === fixtures[0].homeTeamId)!
    // With a fixed 9-0 win already on the books, this team should have picked
    // up at least 3 points (the played match) in every single run.
    expect(homeTeam.expectedPoints).toBeGreaterThanOrEqual(3)
  })

  it('simulates 10000 runs of a 36-team / 8-match UCL-sized league phase in well under 1s', () => {
    const teams = makeTeams(36)
    const config = makeConfig('ucl-perf', 8)
    const fixtures = buildLeaguePhaseFixtures(teams.map((t) => t.id), 8, 'ucl')

    const start = performance.now()
    const result = simulate(config, teams, fixtures, [], 10000, { seed: 'perf' })
    const elapsed = performance.now() - start

    expect(result.runs).toBe(10000)
    expect(elapsed).toBeLessThan(1000)
  })
})
