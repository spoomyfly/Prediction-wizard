import type { ModelDefaults, Team } from './types'
import type { RandomFn } from './rng'
import { randomNormal } from './rng'

/**
 * Return a copy of the team list with per-run rating noise applied, to
 * reflect uncertainty in the strength estimate. Noise is sampled once per
 * team per simulation run (not per match) so a team's noisy strength stays
 * consistent across all its matches within that run.
 *
 * Football: sigma is a fractional multiplier std dev applied to attack/defense.
 * Dota 2:   sigma is an Elo-points std dev applied to the team rating.
 */
export function applyRatingNoise(
  teams: Team[],
  defaults: ModelDefaults,
  rng: RandomFn,
): Team[] {
  const sigma = defaults.sigma ?? 0
  if (sigma <= 0) return teams

  return teams.map((team) => {
    const noisy: Team = { ...team }
    if (team.attack !== undefined) {
      noisy.attack = Math.max(0.05, team.attack * (1 + randomNormal(rng, 0, sigma)))
    }
    if (team.defense !== undefined) {
      noisy.defense = Math.max(0.05, team.defense * (1 + randomNormal(rng, 0, sigma)))
    }
    if (team.elo !== undefined) {
      noisy.elo = team.elo + randomNormal(rng, 0, sigma)
    }
    return noisy
  })
}
