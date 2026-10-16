import type { Fixture, FootballResult, MatchPrediction, ScorelineProbability } from './types'

/**
 * Scorelines with more than this many goals on a side are lumped together
 * rather than tracked individually. They are far too rare to show in a
 * "most likely scores" list, and the cap keeps each match's tally to a
 * fixed-size array instead of a growing map on the Monte Carlo hot path.
 */
export const MAX_TRACKED_GOALS = 6

const GRID = MAX_TRACKED_GOALS + 1

/**
 * Per-fixture tally of sampled outcomes, filled during the same Monte Carlo
 * run that produces the standings.
 *
 * Deriving match odds from the run itself rather than from a separate
 * closed-form calculation keeps them consistent with the table: both see the
 * same rating noise and the same Dixon-Coles correction, so a match can never
 * show odds the standings disagree with.
 */
export class MatchStatsCollector {
  /** Indices into `fixtures` of the fixtures that still need simulating. */
  private readonly indices: number[] = []
  private readonly fixtures: Fixture[] = []
  private readonly homeWins: number[] = []
  private readonly draws: number[] = []
  private readonly awayWins: number[] = []
  private readonly homeGoals: number[] = []
  private readonly awayGoals: number[] = []
  /** One flat GRID x GRID scoreline grid per tracked fixture. */
  private readonly grids: Int32Array[] = []
  private runs = 0

  constructor(fixtures: Fixture[], playedFixtureIds: ReadonlySet<string>) {
    for (let i = 0; i < fixtures.length; i++) {
      if (playedFixtureIds.has(fixtures[i].id)) continue
      this.indices.push(i)
      this.fixtures.push(fixtures[i])
      this.homeWins.push(0)
      this.draws.push(0)
      this.awayWins.push(0)
      this.homeGoals.push(0)
      this.awayGoals.push(0)
      this.grids.push(new Int32Array(GRID * GRID))
    }
  }

  get trackedCount(): number {
    return this.indices.length
  }

  /** Record one completed run. `results[i]` must correspond to `fixtures[i]`. */
  record(results: FootballResult[]): void {
    this.runs++
    for (let t = 0; t < this.indices.length; t++) {
      const result = results[this.indices[t]]
      const home = result.homeGoals
      const away = result.awayGoals

      if (home > away) this.homeWins[t]++
      else if (home < away) this.awayWins[t]++
      else this.draws[t]++

      this.homeGoals[t] += home
      this.awayGoals[t] += away

      const h = home > MAX_TRACKED_GOALS ? MAX_TRACKED_GOALS : home
      const a = away > MAX_TRACKED_GOALS ? MAX_TRACKED_GOALS : away
      this.grids[t][h * GRID + a]++
    }
  }

  /** Turn the tallies into probabilities. Returns [] if no run was recorded. */
  finish(topScorelines = 3): MatchPrediction[] {
    if (this.runs === 0) return []
    const runs = this.runs

    return this.fixtures.map((fixture, t) => {
      const grid = this.grids[t]
      const scores: ScorelineProbability[] = []
      for (let h = 0; h < GRID; h++) {
        for (let a = 0; a < GRID; a++) {
          const count = grid[h * GRID + a]
          if (count === 0) continue
          scores.push({ homeGoals: h, awayGoals: a, probability: count / runs })
        }
      }
      // Ties broken by the lower-scoring line first, so repeated runs with the
      // same seed always print the same list.
      scores.sort(
        (x, y) =>
          y.probability - x.probability ||
          x.homeGoals + x.awayGoals - (y.homeGoals + y.awayGoals) ||
          x.homeGoals - y.homeGoals,
      )

      return {
        fixtureId: fixture.id,
        matchday: fixture.matchday,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeWin: this.homeWins[t] / runs,
        draw: this.draws[t] / runs,
        awayWin: this.awayWins[t] / runs,
        expectedHomeGoals: this.homeGoals[t] / runs,
        expectedAwayGoals: this.awayGoals[t] / runs,
        topScorelines: scores.slice(0, topScorelines),
      }
    })
  }
}

/** The lowest matchday that still has an unplayed fixture, or undefined when none remain. */
export function nextMatchday(
  fixtures: Fixture[],
  playedFixtureIds: ReadonlySet<string>,
): number | undefined {
  let next: number | undefined
  for (const fixture of fixtures) {
    if (playedFixtureIds.has(fixture.id)) continue
    if (next === undefined || fixture.matchday < next) next = fixture.matchday
  }
  return next
}
