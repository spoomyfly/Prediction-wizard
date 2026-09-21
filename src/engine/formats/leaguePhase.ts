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

function freshStandingsMap(teams: Team[]): Map<string, StandingsRow> {
  const standings = new Map<string, StandingsRow>()
  for (const team of teams) {
    const row = emptyRow(team.id)
    row.disciplinaryPoints = team.disciplinaryPoints ?? 0
    row.clubCoefficient = team.clubCoefficient ?? 0
    standings.set(team.id, row)
  }
  return standings
}

/** Tally standings from a fixed set of (fixture, result) pairs. Pure and side-effect free. */
export function computeStandings(
  teams: Team[],
  fixtures: Fixture[],
  results: FootballResult[],
): StandingsRow[] {
  const standings = freshStandingsMap(teams)
  const resultByFixture = new Map(results.map((r) => [r.fixtureId, r]))
  for (const fixture of fixtures) {
    const result = resultByFixture.get(fixture.id)
    if (result) applyResultToStandings(standings, fixture, result)
  }
  return Array.from(standings.values())
}

/**
 * Same tally as computeStandings, but assumes results[i] is exactly the
 * result for fixtures[i] (no fixtureId lookup needed) — used on the Monte
 * Carlo hot path, where every fixture always has a result (played or
 * sampled) in fixture order.
 */
function tallyStandingsOrdered(
  teams: Team[],
  fixtures: Fixture[],
  results: FootballResult[],
): StandingsRow[] {
  const standings = freshStandingsMap(teams)
  for (let i = 0; i < fixtures.length; i++) {
    applyResultToStandings(standings, fixtures[i], results[i])
  }
  return Array.from(standings.values())
}

/** Precomputed, run-invariant inputs for simulateLeaguePhaseOnce, built once per simulate() call. */
export interface LeaguePhaseContext {
  opponentsByTeam: Map<string, string[]>
  playedByFixture: Map<string, FootballResult>
  needsRandomSalt: boolean
}

const EMPTY_RANDOM_SALT: Map<string, number> = new Map()

export function prepareLeaguePhase(
  fixtures: Fixture[],
  playedResults: FootballResult[],
  config: CompetitionConfig,
): LeaguePhaseContext {
  return {
    opponentsByTeam: buildOpponentsByTeam(fixtures),
    playedByFixture: new Map(playedResults.map((r) => [r.fixtureId, r])),
    needsRandomSalt: config.tiebreakers.includes('random'),
  }
}

/**
 * Simulate one Monte Carlo run of the league phase: already-played fixtures
 * keep their real result, remaining fixtures are sampled from the Poisson
 * goal model with per-run rating noise applied. Returns standings rows
 * ordered from 1st to last place after applying the configured tiebreaker
 * chain (`prepareLeaguePhase` hoists everything that doesn't change between
 * runs, since this runs inside a tight n-times loop).
 */
export function simulateLeaguePhaseOnce(
  teams: Team[],
  fixtures: Fixture[],
  config: CompetitionConfig,
  rng: RandomFn,
  context: LeaguePhaseContext,
): StandingsRow[] {
  const noisyTeams = applyRatingNoise(teams, config.modelDefaults, rng)
  const teamById = new Map(noisyTeams.map((t) => [t.id, t]))

  const allResults: FootballResult[] = new Array(fixtures.length)
  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i]
    const played = context.playedByFixture.get(fixture.id)
    if (played) {
      allResults[i] = played
      continue
    }
    const home = teamById.get(fixture.homeTeamId)!
    const away = teamById.get(fixture.awayTeamId)!
    const { homeGoals, awayGoals } = sampleFootballScore(rng, home, away, config.modelDefaults)
    allResults[i] = { fixtureId: fixture.id, homeGoals, awayGoals }
  }

  const standings = tallyStandingsOrdered(teams, fixtures, allResults)
  const rowsByTeam = new Map(standings.map((row) => [row.teamId, row]))
  const randomSalt = context.needsRandomSalt
    ? new Map(teams.map((t) => [t.id, rng()]))
    : EMPTY_RANDOM_SALT

  return sortStandings(standings, config.tiebreakers, {
    rowsByTeam,
    opponentsByTeam: context.opponentsByTeam,
    randomSalt,
  })
}

function isFootballResults(results: MatchResult[]): results is FootballResult[] {
  return results.every(isFootballResult)
}

export { isFootballResults }
