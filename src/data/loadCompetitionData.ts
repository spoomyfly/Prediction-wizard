import type { Fixture, MatchResult, Team } from '../engine/types'

export interface TeamRecord {
  id: string
  name: string
  country?: string
  clubCoefficient?: number
  disciplinaryPoints?: number
}

export interface RatingRecord {
  id: string
  elo?: number
  attack?: number
  defense?: number
}

export interface RatingsFile {
  asOf: string
  source: string
  note?: string
  teams: RatingRecord[]
}

export interface CompetitionData {
  teams: Team[]
  fixtures: Fixture[]
  results: MatchResult[]
  ratingsAsOf: string
  ratingsSource: string
  ratingsNote?: string
}

class DataValidationError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DataValidationError(message)
}

function validateTeams(data: unknown, competitionId: string): TeamRecord[] {
  assert(Array.isArray(data), `${competitionId}/teams.json: expected an array`)
  for (const t of data) {
    assert(t && typeof t.id === 'string', `${competitionId}/teams.json: team missing "id"`)
    assert(typeof t.name === 'string', `${competitionId}/teams.json: team "${t.id}" missing "name"`)
  }
  return data as TeamRecord[]
}

function validateFixtures(data: unknown, competitionId: string): Fixture[] {
  assert(Array.isArray(data), `${competitionId}/fixtures.json: expected an array`)
  for (const f of data) {
    assert(f && typeof f.id === 'string', `${competitionId}/fixtures.json: fixture missing "id"`)
    assert(typeof f.homeTeamId === 'string', `${competitionId}/fixtures.json: fixture "${f.id}" missing "homeTeamId"`)
    assert(typeof f.awayTeamId === 'string', `${competitionId}/fixtures.json: fixture "${f.id}" missing "awayTeamId"`)
    assert(typeof f.matchday === 'number', `${competitionId}/fixtures.json: fixture "${f.id}" missing "matchday"`)
  }
  return data as Fixture[]
}

function validateResults(data: unknown, competitionId: string): MatchResult[] {
  assert(Array.isArray(data), `${competitionId}/results.json: expected an array`)
  for (const r of data) {
    assert(r && typeof r.fixtureId === 'string', `${competitionId}/results.json: result missing "fixtureId"`)
    const isFootball = typeof r.homeGoals === 'number' && typeof r.awayGoals === 'number'
    const isSeries = typeof r.homeMapWins === 'number' && typeof r.awayMapWins === 'number'
    assert(isFootball || isSeries, `${competitionId}/results.json: result "${r.fixtureId}" has neither goals nor map-wins fields`)
  }
  return data as MatchResult[]
}

function validateRatings(data: unknown, competitionId: string): RatingsFile {
  assert(data && typeof data === 'object', `${competitionId}/ratings.json: expected an object`)
  const ratings = data as RatingsFile
  assert(Array.isArray(ratings.teams), `${competitionId}/ratings.json: expected "teams" array`)
  for (const t of ratings.teams) {
    assert(typeof t.id === 'string', `${competitionId}/ratings.json: rating entry missing "id"`)
  }
  return ratings
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
  return res.json()
}

/** Load, lightly validate and merge one competition's static JSON data files. */
export async function loadCompetitionData(competitionId: string): Promise<CompetitionData> {
  const base = `${import.meta.env.BASE_URL}data/${competitionId}`

  const [teamsRaw, fixturesRaw, resultsRaw, ratingsRaw] = await Promise.all([
    fetchJson(`${base}/teams.json`),
    fetchJson(`${base}/fixtures.json`),
    fetchJson(`${base}/results.json`),
    fetchJson(`${base}/ratings.json`),
  ])

  const teamRecords = validateTeams(teamsRaw, competitionId)
  const fixtures = validateFixtures(fixturesRaw, competitionId)
  const results = validateResults(resultsRaw, competitionId)
  const ratings = validateRatings(ratingsRaw, competitionId)

  const ratingByTeam = new Map(ratings.teams.map((r) => [r.id, r]))
  const teams: Team[] = teamRecords.map((t) => {
    const rating = ratingByTeam.get(t.id)
    return {
      id: t.id,
      name: t.name,
      country: t.country,
      clubCoefficient: t.clubCoefficient,
      disciplinaryPoints: t.disciplinaryPoints,
      elo: rating?.elo,
      attack: rating?.attack,
      defense: rating?.defense,
    }
  })

  return {
    teams,
    fixtures,
    results,
    ratingsAsOf: ratings.asOf,
    ratingsSource: ratings.source,
    ratingsNote: ratings.note,
  }
}
