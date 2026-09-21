import type {
  CompetitionConfig,
  Fixture,
  FootballResult,
  MatchResult,
  SimulationResult,
  Team,
  TeamSimulationResult,
} from './types'
import { hashSeed, mulberry32 } from './rng'
import { isFootballResults, prepareLeaguePhase, simulateLeaguePhaseOnce } from './formats/leaguePhase'

export interface SimulateOptions {
  /** Numeric seed, or a string that gets hashed into one, for reproducible runs. */
  seed?: number | string
  /** Called periodically during the run with the number of completed iterations. */
  onProgress?: (completed: number, total: number) => void
  /** How many completed runs between progress callbacks. Default: every 1% (min 100). */
  progressEvery?: number
}

/**
 * Run a Monte Carlo simulation of `config`'s format `n` times and return,
 * per team, the resulting distribution of final positions, zone
 * probabilities, expected points and expected position.
 *
 * Already-played fixtures (present in `results`) are never re-simulated;
 * only the remaining fixtures are sampled each run.
 */
export function simulate(
  config: CompetitionConfig,
  teams: Team[],
  fixtures: Fixture[],
  results: MatchResult[],
  n: number,
  options: SimulateOptions = {},
): SimulationResult {
  const startedAt = performance.now()
  const seedInput = options.seed ?? `${config.id}-default-seed`
  const numericSeed = typeof seedInput === 'number' ? seedInput >>> 0 : hashSeed(String(seedInput))
  const rng = mulberry32(numericSeed)

  const teamCount = teams.length
  const positionCounts = new Map<string, number[]>()
  const pointsSum = new Map<string, number>()
  for (const team of teams) {
    positionCounts.set(team.id, new Array(teamCount).fill(0))
    pointsSum.set(team.id, 0)
  }

  const progressEvery = options.progressEvery ?? Math.max(100, Math.floor(n / 100))

  if (config.format.type !== 'league-phase') {
    throw new Error(
      `Simulation for format "${config.format.type}" is not implemented yet (competition: ${config.id})`,
    )
  }
  if (config.matchModel !== 'poisson-goals' || !isFootballResults(results)) {
    throw new Error(
      `League-phase format currently only supports the poisson-goals match model (competition: ${config.id})`,
    )
  }
  const footballResults: FootballResult[] = results
  const context = prepareLeaguePhase(fixtures, footballResults, config)

  for (let run = 0; run < n; run++) {
    const standings = simulateLeaguePhaseOnce(teams, fixtures, config, rng, context)
    for (let position = 0; position < standings.length; position++) {
      const row = standings[position]
      positionCounts.get(row.teamId)![position]++
      pointsSum.set(row.teamId, pointsSum.get(row.teamId)! + row.points)
    }

    if (options.onProgress && (run + 1) % progressEvery === 0) {
      options.onProgress(run + 1, n)
    }
  }
  options.onProgress?.(n, n)

  const teamResults: TeamSimulationResult[] = teams.map((team) => {
    const counts = positionCounts.get(team.id)!
    const zoneProbabilities: Record<string, number> = {}
    for (const zone of config.zones) {
      let zoneCount = 0
      for (let position = zone.from - 1; position <= zone.to - 1 && position < counts.length; position++) {
        zoneCount += counts[position]
      }
      zoneProbabilities[zone.id] = zoneCount / n
    }
    const expectedPosition = counts.reduce((sum, count, idx) => sum + count * (idx + 1), 0) / n

    return {
      teamId: team.id,
      positionCounts: counts,
      zoneProbabilities,
      expectedPoints: pointsSum.get(team.id)! / n,
      expectedPosition,
    }
  })

  return {
    competitionId: config.id,
    runs: n,
    seed: numericSeed,
    durationMs: performance.now() - startedAt,
    teams: teamResults,
  }
}
