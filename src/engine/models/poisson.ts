import type { ModelDefaults, Team } from '../types'
import type { RandomFn } from '../rng'
import { randomPoisson } from '../rng'

export interface PoissonExpectedGoals {
  lambdaHome: number
  lambdaAway: number
}

/**
 * Expected goals for both sides:
 *   lambda_home = avg * att_home * def_away * homeAdv
 *   lambda_away = avg * att_away * def_home
 */
export function expectedGoals(
  home: Team,
  away: Team,
  defaults: ModelDefaults,
): PoissonExpectedGoals {
  const avg = defaults.avgGoals ?? 1.35
  const homeAdv = defaults.homeAdv ?? 1.15
  const attHome = home.attack ?? 1
  const defHome = home.defense ?? 1
  const attAway = away.attack ?? 1
  const defAway = away.defense ?? 1

  return {
    lambdaHome: avg * attHome * defAway * homeAdv,
    lambdaAway: avg * attAway * defHome,
  }
}

/**
 * Dixon-Coles low-score adjustment factor, applied to the independent
 * Poisson joint probability for (0,0), (1,0), (0,1) and (1,1) scorelines.
 * rho = 0 disables the correction (default).
 */
export function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  if (rho === 0) return 1
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambdaHome * lambdaAway * rho
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambdaHome * rho
  if (homeGoals === 1 && awayGoals === 0) return 1 + lambdaAway * rho
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho
  return 1
}

/**
 * Sample a final score for one match. When rho !== 0, uses rejection
 * sampling driven by the Dixon-Coles tau correction on low scorelines.
 */
export function sampleFootballScore(
  rng: RandomFn,
  home: Team,
  away: Team,
  defaults: ModelDefaults,
): { homeGoals: number; awayGoals: number } {
  const { lambdaHome, lambdaAway } = expectedGoals(home, away, defaults)
  const rho = defaults.rho ?? 0

  if (rho === 0) {
    return {
      homeGoals: randomPoisson(rng, lambdaHome),
      awayGoals: randomPoisson(rng, lambdaAway),
    }
  }

  // Rejection sampling: draw independent Poisson goals, then accept with
  // probability proportional to the Dixon-Coles tau correction (tau <= 1 + |rho|).
  const maxTau = 1 + Math.abs(rho) * Math.max(lambdaHome, lambdaAway, 1)
  for (let attempt = 0; attempt < 50; attempt++) {
    const homeGoals = randomPoisson(rng, lambdaHome)
    const awayGoals = randomPoisson(rng, lambdaAway)
    const tau = dixonColesTau(homeGoals, awayGoals, lambdaHome, lambdaAway, rho)
    if (rng() * maxTau <= tau) {
      return { homeGoals, awayGoals }
    }
  }
  return { homeGoals: randomPoisson(rng, lambdaHome), awayGoals: randomPoisson(rng, lambdaAway) }
}
