import type { CompetitionConfig, Zone } from '../../engine/types'

// The International's placement bands: Swiss stage feeds a double-elimination
// playoff bracket, so final places cluster into fixed-prize bands rather than
// a single 1..N table. Used for the results-page zone display once the
// swiss/double-elim formats are implemented (see engine/formats/*.ts TODOs).
const tiZones: Zone[] = [
  { id: 'champion', label: '1 место', from: 1, to: 1, color: '#f59f00' },
  { id: 'runner-up', label: '2 место', from: 2, to: 2, color: '#adb5bd' },
  { id: 'top4', label: '3–4 место', from: 3, to: 4, color: '#4dabf7' },
  { id: 'top6', label: '5–6 место', from: 5, to: 6, color: '#63e6be' },
  { id: 'top8', label: '7–8 место', from: 7, to: 8, color: '#91a7ff' },
  { id: 'top12', label: '9–12 место', from: 9, to: 12, color: '#ced4da' },
  { id: 'top16', label: '13–16 место', from: 13, to: 16, color: '#868e96' },
  { id: 'out', label: '17–18 место (выбывание в Swiss)', from: 17, to: 18, color: '#e03131' },
]

export const tiConfig: CompetitionConfig = {
  id: 'ti-2026',
  name: 'The International 2026',
  sport: 'dota2',
  season: '2026',
  // Real format: Swiss-system group stage, then a double-elimination
  // playoff bracket. Both stages are stubbed (engine/formats/swiss.ts and
  // doubleElim.ts) — this competition currently only powers the read-only
  // "Сила команд" ratings page; the results page shows a placeholder.
  format: { type: 'swiss' },
  matchModel: 'bo-series',
  tiebreakers: [],
  zones: tiZones,
  modelDefaults: {
    // Elo-points std dev applied per simulation run (bigger than football
    // because roster/meta shifts make Dota team strength noisier).
    sigma: 60,
    bestOf: 3,
  },
  description:
    'Swiss-система + плей-офф на выбывание с двумя поражениями. Демо-данные, полная симуляция формата — в разработке.',
}
