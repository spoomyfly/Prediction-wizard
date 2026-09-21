import type { Team } from '../types'
import type { RandomFn } from '../rng'

/** Elo win probability for the "home"/challenger side: p = 1 / (1 + 10^(-(Ra-Rb)/400)). */
export function eloWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, -(ratingA - ratingB) / 400))
}

export interface SeriesOutcome {
  homeMapWins: number
  awayMapWins: number
}

/**
 * Simulate a best-of-N map series map by map using Elo win probability.
 * - Bo1: single map, no draw possible.
 * - Bo2: two maps, can end 1-1 (draw permitted per current tournament rules).
 * - Bo3/Bo5: first to ceil(bestOf/2) map wins.
 */
export function sampleSeries(
  rng: RandomFn,
  home: Team,
  away: Team,
  bestOf: number,
): SeriesOutcome {
  const ratingHome = home.elo ?? 1000
  const ratingAway = away.elo ?? 1000
  const pHomeMap = eloWinProbability(ratingHome, ratingAway)

  let homeMapWins = 0
  let awayMapWins = 0
  const winsNeeded = bestOf === 2 ? 2 : Math.ceil((bestOf + 1) / 2)

  for (let mapNum = 0; mapNum < bestOf; mapNum++) {
    if (bestOf !== 2 && (homeMapWins >= winsNeeded || awayMapWins >= winsNeeded)) break
    if (rng() < pHomeMap) homeMapWins++
    else awayMapWins++
  }

  return { homeMapWins, awayMapWins }
}
