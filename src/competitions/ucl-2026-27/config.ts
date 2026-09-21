import type { CompetitionConfig } from '../../engine/types'
import { uefaTiebreakers, uefaZones } from '../uefaShared'

export const uclConfig: CompetitionConfig = {
  id: 'ucl-2026-27',
  name: 'Лига чемпионов УЕФА',
  sport: 'football',
  season: '2026/27',
  format: { type: 'league-phase', matchesPerTeam: 8 },
  matchModel: 'poisson-goals',
  tiebreakers: uefaTiebreakers,
  zones: uefaZones(),
  modelDefaults: {
    avgGoals: 1.4,
    homeAdv: 1.15,
    sigma: 0.12,
    rho: 0,
  },
  description: '36 команд, единый этап лиги по 8 матчей, топ-8 — в 1/8 финала напрямую.',
}
