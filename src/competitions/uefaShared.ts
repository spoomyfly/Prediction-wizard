import type { TiebreakerId, Zone } from '../engine/types'

/**
 * UEFA league-phase tiebreaker order (Champions League, Europa League and
 * Conference League all use the same chain in the 2026/27 regulations):
 *   1. goal difference
 *   2. goals scored
 *   3. away goals scored
 *   4. wins
 *   5. away wins
 *   6. sum of points of the opponents played
 *   7. sum of goal difference of the opponents played
 *   8. sum of goals scored by the opponents played
 *   9. disciplinary points (fewer is better)
 *   10. UEFA club coefficient
 */
export const uefaTiebreakers: TiebreakerId[] = [
  'goal-difference',
  'goals-for',
  'away-goals',
  'wins',
  'away-wins',
  'opponents-points-sum',
  'opponents-goal-difference-sum',
  'opponents-goals-for-sum',
  'disciplinary-points',
  'club-coefficient',
]

export function uefaZones(): Zone[] {
  return [
    { id: 'ro16', label: '1–8: напрямую в 1/8 финала', from: 1, to: 8, color: '#2f9e44' },
    { id: 'playoff', label: '9–24: стыковой раунд', from: 9, to: 24, color: '#f08c00' },
    { id: 'out', label: '25–36: выбывание', from: 25, to: 36, color: '#e03131' },
  ]
}
