import type { CompetitionConfig } from '../../engine/types'
import { uefaTiebreakers } from '../uefaShared'
import type { Zone } from '../../engine/types'

// Same shape as the UCL/UEL zones but for 6 matches per team the meaning
// of the ranges is identical (1-8 direct, 9-24 play-off, 25-36 out) —
// UEFA keeps the same 36-team / three-zone structure across all three
// club competitions, only the number of league-phase matches differs.
const ueclZones: Zone[] = [
  { id: 'ro16', label: '1–8: напрямую в 1/8 финала', from: 1, to: 8, color: '#2f9e44' },
  { id: 'playoff', label: '9–24: стыковой раунд', from: 9, to: 24, color: '#f08c00' },
  { id: 'out', label: '25–36: выбывание', from: 25, to: 36, color: '#e03131' },
]

export const ueclConfig: CompetitionConfig = {
  id: 'uecl-2026-27',
  name: 'Лига конференций УЕФА',
  sport: 'football',
  season: '2026/27',
  format: { type: 'league-phase', matchesPerTeam: 6 },
  matchModel: 'poisson-goals',
  tiebreakers: uefaTiebreakers,
  zones: ueclZones,
  modelDefaults: {
    avgGoals: 1.5,
    homeAdv: 1.15,
    sigma: 0.16,
    rho: 0,
  },
  description: '36 команд, единый этап лиги по 6 матчей, топ-8 — в 1/8 финала напрямую.',
}
