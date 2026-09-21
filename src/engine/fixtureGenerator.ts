import type { Fixture } from './types'

/**
 * Generate round-robin rounds via the circle method: N-1 rounds (N even,
 * a "bye" placeholder is added for odd N) where every team meets a
 * different opponent each round and no pairing repeats.
 */
export function generateRoundRobinRounds(teamIds: string[]): [string, string][][] {
  const ids = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, '__bye__']
  const n = ids.length
  const rounds: [string, string][][] = []
  const arr = ids.slice()

  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== '__bye__' && b !== '__bye__') {
        // Alternate which side is "home" so home/away stays roughly balanced.
        pairs.push((round + i) % 2 === 0 ? [a, b] : [b, a])
      }
    }
    rounds.push(pairs)

    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop() as string)
    arr.splice(0, arr.length, fixed, ...rest)
  }

  return rounds
}

/**
 * Build a "league phase" fixture list where every team plays exactly
 * `matchesPerTeam` distinct opponents. Used both for seed data generation
 * and engine tests. This is a structurally-valid simplification of UEFA's
 * real pot-based Swiss draw (which also balances opponent strength/country) —
 * see README for the caveat.
 */
export function buildLeaguePhaseFixtures(
  teamIds: string[],
  matchesPerTeam: number,
  idPrefix: string,
): Fixture[] {
  const rounds = generateRoundRobinRounds(teamIds).slice(0, matchesPerTeam)
  const fixtures: Fixture[] = []
  let counter = 0
  rounds.forEach((pairs, roundIdx) => {
    pairs.forEach(([home, away]) => {
      fixtures.push({
        id: `${idPrefix}-${counter++}`,
        matchday: roundIdx + 1,
        homeTeamId: home,
        awayTeamId: away,
      })
    })
  })
  return fixtures
}
