import type { CompetitionConfig } from '../../engine/types'
import { uefaTiebreakers, uefaZones } from '../uefaShared'

export const uelConfig: CompetitionConfig = {
  id: 'uel-2026-27',
  name: 'Лига Европы УЕФА',
  sport: 'football',
  season: '2026/27',
  format: { type: 'league-phase', matchesPerTeam: 8 },
  matchModel: 'poisson-goals',
  tiebreakers: uefaTiebreakers,
  zones: uefaZones(),
  modelDefaults: {
    avgGoals: 1.45,
    homeAdv: 1.15,
    sigma: 0.14,
    rho: 0,
  },
  description: '36 команд, единый этап лиги по 8 матчей, топ-8 — в 1/8 финала напрямую.',
}
