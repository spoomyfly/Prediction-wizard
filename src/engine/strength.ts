import type { Team } from './types'

/** Per-team manual overrides, keyed by team id. */
export interface TeamAdjustment {
  /** Override Elo rating for this team. Falls back to the team's own `elo` when unset. */
  elo?: number
  /** Manual boost/penalty, e.g. 0.1 = +10%. Raises attack and lowers defense (and vice versa for negative values). */
  adjustmentPct?: number
}

export interface StrengthParams {
  /**
   * How strongly Elo differences translate into attack/defense spread.
   * 0 = every team's attack/defense collapses to 1 (pure coin-flip model),
   * 1 = this module's default calibration, >1 exaggerates the gap between
   * strong and weak teams.
   */
  ratingInfluence: number
  overrides?: Record<string, TeamAdjustment>
}

// Same calibration scripts/generate-seed-data.ts used to bake ratings.json's
// attack/defense at generation time — kept here as the one source of truth
// so the runtime (this module) and the offline generator never drift apart.
const ATTACK_SPREAD = 0.35
const DEFENSE_SPREAD = 0.3
const ELO_SPAN = 300
const ATTACK_DEFENSE_MIN = 0.35
const ATTACK_DEFENSE_MAX = 2.2

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function clamp(value: number): number {
  return Math.min(ATTACK_DEFENSE_MAX, Math.max(ATTACK_DEFENSE_MIN, value))
}

/**
 * Resolve each team's effective attack/defense multipliers for a
 * simulation run, from Elo + strength params (rating influence, per-team
 * Elo overrides, per-team manual adjustments).
 *
 * Pure and side-effect free. Cheap enough to call for every keystroke on
 * the "Сила команд" page (live preview) and once per simulate() call (not
 * per Monte Carlo run — only noise.ts varies run to run).
 */
export function resolveTeamStrengths(teams: Team[], params: StrengthParams | undefined): Team[] {
  if (!params) return teams

  const influence = params.ratingInfluence
  const overrides = params.overrides ?? {}

  const effectiveElo = teams.map((team) => overrides[team.id]?.elo ?? team.elo)
  const knownElo = effectiveElo.filter((elo): elo is number => elo !== undefined)
  if (knownElo.length === 0) return teams
  const meanElo = mean(knownElo)

  const withStrength = teams.map((team, i) => {
    const elo = effectiveElo[i]
    if (elo === undefined) return team

    const strength = ((elo - meanElo) / ELO_SPAN) * influence
    let attack = 1 + strength * ATTACK_SPREAD
    let defense = 1 - strength * DEFENSE_SPREAD

    const adjustment = overrides[team.id]?.adjustmentPct
    if (adjustment) {
      attack *= 1 + adjustment
      defense *= 1 - adjustment
    }

    return { ...team, elo, attack, defense }
  })

  // Normalize back to a field-wide mean of 1.0, so avgGoals keeps its
  // literal meaning even after ratingInfluence/overrides/adjustments shift
  // the pool's center of mass away from 1.
  const attacks = withStrength.map((t) => t.attack).filter((v): v is number => v !== undefined)
  const defenses = withStrength.map((t) => t.defense).filter((v): v is number => v !== undefined)
  const meanAttack = mean(attacks) || 1
  const meanDefense = mean(defenses) || 1

  return withStrength.map((team) => ({
    ...team,
    attack: team.attack !== undefined ? clamp(team.attack / meanAttack) : team.attack,
    defense: team.defense !== undefined ? clamp(team.defense / meanDefense) : team.defense,
  }))
}
