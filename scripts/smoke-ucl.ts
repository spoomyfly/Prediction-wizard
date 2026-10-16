/**
 * Headless run of the real pipeline against the shipped UCL data, so the
 * numbers can be compared with the independent Python model before deploying.
 * Run with: npx tsx scripts/smoke-ucl.ts
 */
import { readFileSync } from 'node:fs'
import { simulate } from '../src/engine/simulate'
import { prepareTeamStrengths } from '../src/engine/strength'
import { defaultEloParams } from '../src/engine/elo'
import { uclConfig } from '../src/competitions/ucl-2026-27/config'
import { nextMatchday } from '../src/engine/matchPredictions'
import type { Fixture, FootballResult, Team } from '../src/engine/types'

const dir = 'public/data/ucl-2026-27'
const read = <T>(f: string): T => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as T

const baseTeams = read<Team[]>('teams.json')
const ratings = read<{ asOf: string; teams: { id: string; elo: number; attack: number; defense: number }[] }>('ratings.json')
const fixtures = read<Fixture[]>('fixtures.json')
const results = read<FootballResult[]>('results.json')

const byId = new Map(ratings.teams.map((r) => [r.id, r]))
const teams: Team[] = baseTeams.map((t) => ({ ...t, ...byId.get(t.id) }))

const { teams: prepared, eloStates } = prepareTeamStrengths(
  teams,
  fixtures,
  results,
  defaultEloParams,
  { ratingInfluence: 1 },
)

const runs = 50_000
const started = Date.now()
const sim = simulate(uclConfig, prepared, fixtures, results, runs, {
  seed: 'smoke',
  collectMatchStats: true,
})
const elapsed = Date.now() - started

const name = new Map(teams.map((t) => [t.id, t.name]))
const rows = sim.teams
  .map((t) => ({
    name: name.get(t.teamId)!,
    elo: Math.round(eloStates.get(t.teamId)?.effectiveElo ?? 0),
    pts: t.expectedPoints,
    pos: t.expectedPosition,
    zones: t.zoneProbabilities,
    sum: t.positionCounts.reduce((a, b) => a + b, 0),
  }))
  .sort((a, b) => (b.zones.ro16 ?? 0) - (a.zones.ro16 ?? 0))

const zoneKeys = Object.keys(rows[0].zones)
console.log(`ratings asOf ${ratings.asOf}; ${results.length} played, ${fixtures.length - results.length} simulated`)
console.log(`${runs.toLocaleString('en-US')} runs in ${elapsed} ms`)
console.log(`zones: ${zoneKeys.join(', ')}`)
console.log(`position counts per team all equal runs: ${rows.every((r) => r.sum === runs)}`)
console.log(
  `zone probabilities sum to 1: ${rows.every(
    (r) => Math.abs(zoneKeys.reduce((a, k) => a + r.zones[k], 0) - 1) < 1e-9,
  )}`,
)
console.log()
console.log('club'.padEnd(22) + 'elo'.padStart(6) + 'pts'.padStart(7) + 'pos'.padStart(6) + zoneKeys.map((k) => k.padStart(9)).join(''))
for (const r of rows) {
  console.log(
    r.name.padEnd(22) +
      String(r.elo).padStart(6) +
      r.pts.toFixed(1).padStart(7) +
      r.pos.toFixed(1).padStart(6) +
      zoneKeys.map((k) => (r.zones[k] * 100).toFixed(1).padStart(8) + '%').join(''),
  )
}

// --- next matchday ----------------------------------------------------
const played = new Set(results.map((r) => r.fixtureId))
const upcoming = nextMatchday(fixtures, played)
const round = (sim.matches ?? []).filter((m) => m.matchday === upcoming)

console.log()
console.log(`next matchday: ${upcoming} (${round.length} games)`)
console.log(
  `odds sum to 1 everywhere: ${(sim.matches ?? []).every(
    (m) => Math.abs(m.homeWin + m.draw + m.awayWin - 1) < 1e-9,
  )}`,
)
console.log(`predictions returned for all unplayed fixtures: ${(sim.matches ?? []).length === fixtures.length - results.length}`)
console.log()
for (const m of round) {
  const line = `${name.get(m.homeTeamId)} - ${name.get(m.awayTeamId)}`
  const odds = `${(m.homeWin * 100).toFixed(0)}/${(m.draw * 100).toFixed(0)}/${(m.awayWin * 100).toFixed(0)}`
  const xg = `${m.expectedHomeGoals.toFixed(2)}:${m.expectedAwayGoals.toFixed(2)}`
  const top = m.topScorelines
    .map((s) => `${s.homeGoals}:${s.awayGoals} ${(s.probability * 100).toFixed(1)}%`)
    .join('  ')
  console.log(`${line.padEnd(42)}${odds.padStart(10)}  xG ${xg.padStart(9)}   ${top}`)
}
