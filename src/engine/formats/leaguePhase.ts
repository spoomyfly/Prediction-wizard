import type {
  CompetitionConfig,
  Fixture,
  FootballResult,
  MatchResult,
  StandingsRow,
  Team,
} from '../types'
import type { RandomFn } from '../rng'
import { sampleFootballScore } from '../models/poisson'
import { applyRatingNoise } from '../noise'
import { buildOpponentsByTeam, sortStandings } from '../tiebreakers'

function isFootballResult(result: MatchResult): result is FootballResult {
  return 'homeGoals' in result
}

function emptyRow(teamId: string): StandingsRow {
  return {
    teamId,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    awayWins: 0,
    awayGoalsFor: 0,
    disciplinaryPoints: 0,
    clubCoefficient: 0,
  }
}

function applyResultToStandings(
  standings: Map<string, StandingsRow>,
  fixture: Fixture,
  result: FootballResult,
): void {
  const home = standings.get(fixture.homeTeamId)
  const away = standings.get(fixture.awayTeamId)
  if (!home || !away) return

  home.played++
  away.played++
  home.goalsFor += result.homeGoals
  home.goalsAgainst += result.awayGoals
  away.goalsFor += result.awayGoals
  away.goalsAgainst += result.homeGoals
  away.awayGoalsFor += result.awayGoals

  if (result.homeGoals > result.awayGoals) {
    home.wins++
    home.points += 3
    away.losses++
  } else if (result.homeGoals < result.awayGoals) {
    away.wins++
    away.awayWins++
    away.points += 3
    home.losses++
  } else {
    home.draws++
    away.draws++
    home.points += 1
    away.points += 1
  }

  home.goalDifference = home.goalsFor - home.goalsAgainst
  away.goalDifference = away.goalsFor - away.goalsAgainst
}

/** Tally standings from a fixed set of (fixture, result) pairs. Pure and side-effect free. */
export function computeStandings(
  teams: Team[],
  fixtures: Fixture[],
  results: FootballResult[],
): StandingsRow[] {
  const standings = new Map<string, StandingsRow>()
  for (const team of teams) {
    const row = emptyRow(team.id)
    row.disciplinaryPoints = team.disciplinaryPoints ?? 0
    row.clubCoefficient = team.clubCoefficient ?? 0
    standings.set(team.id, row)
  }

  const resultByFixture = new Map(results.map((r) => [r.fixtureId, r]))
  for (const fixture of fixtures) {
    const result = resultByFixture.get(fixture.id)
    if (result) applyResultToStandings(standings, fixture, result)
  }

  return Array.from(standings.values())
}

/**
 * Simulate one Monte Carlo run of the league phase: already-played fixtures
 * keep their real result, remaining fixtures are sampled from the Poisson
 * goal model with per-run rating noise applied. Returns team ids ordered
 * from 1st to last place after applying the configured tiebreaker chain.
 */
export function simulateLeaguePhaseOnce(
  teams: Team[],
  fixtures: Fixture[],
  playedResults: FootballResult[],
  config: CompetitionConfig,
  rng: RandomFn,
): StandingsRow[] {
  const noisyTeams = applyRatingNoise(teams, config.modelDefaults, rng)
  const teamById = new Map(noisyTeams.map((t) => [t.id, t]))

  const resultByFixture = new Map(playedResults.map((r) => [r.fixtureId, r]))
  const allResults: FootballResult[] = [...playedResults]

  for (const fixture of fixtures) {
    if (resultByFixture.has(fixture.id)) continue
    const home = teamById.get(fixture.homeTeamId)
    const away = teamById.get(fixture.awayTeamId)
    if (!home || !away) continue
    const { homeGoals, awayGoals } = sampleFootballScore(rng, home, away, config.modelDefaults)
    allResults.push({ fixtureId: fixture.id, homeGoals, awayGoals })
  }

  const standings = computeStandings(teams, fixtures, allResults)
  const rowsByTeam = new Map(standings.map((row) => [row.teamId, row]))
  const opponentsByTeam = buildOpponentsByTeam(fixtures)
  const randomSalt = new Map(teams.map((t) => [t.id, rng()]))

  return sortStandings(standings, config.tiebreakers, {
    rowsByTeam,
    opponentsByTeam,
    randomSalt,
  })
}

function isFootballResults(results: MatchResult[]): results is FootballResult[] {
  return results.every(isFootballResult)
}

export { isFootballResults }
