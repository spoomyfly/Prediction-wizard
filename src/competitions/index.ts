import type { CompetitionConfig } from '../engine/types'
import { uclConfig } from './ucl-2026-27/config'
import { uelConfig } from './uel-2026-27/config'
import { ueclConfig } from './uecl-2026-27/config'
import { tiConfig } from './ti-2026/config'

/**
 * Every competition the app knows about, keyed by id. Adding a new
 * competition (any sport) means creating a new folder with a config.ts
 * (and matching public/data/<id>/*.json) and registering it here — the
 * simulation engine itself never needs to change.
 */
export const competitions: CompetitionConfig[] = [uclConfig, uelConfig, ueclConfig, tiConfig]

export const competitionsById: Record<string, CompetitionConfig> = Object.fromEntries(
  competitions.map((c) => [c.id, c]),
)

export function getCompetition(id: string): CompetitionConfig | undefined {
  return competitionsById[id]
}
