import type { StandingsRow, TiebreakerId } from './types'

export interface TiebreakContext {
  rowsByTeam: Map<string, StandingsRow>
  /** Ids of opponents each team has played (deduped), used for the "sum of opponents' X" tiebreakers. */
  opponentsByTeam: Map<string, string[]>
  /** Stable per-run random value per team, used only by the 'random' last-resort tiebreaker. */
  randomSalt: Map<string, number>
}

type TiebreakerFn = (row: StandingsRow, ctx: TiebreakContext) => number

function sumOverOpponents(
  teamId: string,
  ctx: TiebreakContext,
  pick: (row: StandingsRow) => number,
): number {
  const opponents = ctx.opponentsByTeam.get(teamId) ?? []
  let sum = 0
  for (const opponentId of opponents) {
    const opponentRow = ctx.rowsByTeam.get(opponentId)
    if (opponentRow) sum += pick(opponentRow)
  }
  return sum
}

// Every function returns a value where HIGHER is BETTER, so the sort in
// sortStandings can always order descending regardless of the tiebreaker.
const tiebreakerFns: Record<TiebreakerId, TiebreakerFn> = {
  'goal-difference': (row) => row.goalDifference,
  'goals-for': (row) => row.goalsFor,
  'away-goals': (row) => row.awayGoalsFor,
  wins: (row) => row.wins,
  'away-wins': (row) => row.awayWins,
  'opponents-points-sum': (row, ctx) =>
    sumOverOpponents(row.teamId, ctx, (r) => r.points),
  'opponents-goal-difference-sum': (row, ctx) =>
    sumOverOpponents(row.teamId, ctx, (r) => r.goalDifference),
  'opponents-goals-for-sum': (row, ctx) =>
    sumOverOpponents(row.teamId, ctx, (r) => r.goalsFor),
  // Fewer disciplinary points is better, so negate to keep the "higher wins" convention.
  'disciplinary-points': (row) => -row.disciplinaryPoints,
  'club-coefficient': (row) => row.clubCoefficient,
  // Not part of the UEFA league-phase chain (no repeated pairings to compare head-to-head on);
  // kept as a documented no-op for formats that may want it later.
  'head-to-head-points': () => 0,
  random: (row, ctx) => ctx.randomSalt.get(row.teamId) ?? 0,
}

/**
 * Sort standings rows by points, then by the given ordered tiebreaker chain.
 * Each tiebreaker is applied lexicographically: it only decides between rows
 * still tied after every earlier criterion in the chain.
 */
export function sortStandings(
  rows: StandingsRow[],
  tiebreakers: TiebreakerId[],
  ctx: TiebreakContext,
): StandingsRow[] {
  const keyed = rows.map((row) => ({
    row,
    keys: [row.points, ...tiebreakers.map((id) => tiebreakerFns[id](row, ctx))],
  }))

  keyed.sort((a, b) => {
    for (let i = 0; i < a.keys.length; i++) {
      if (a.keys[i] !== b.keys[i]) return b.keys[i] - a.keys[i]
    }
    return 0
  })

  return keyed.map((k) => k.row)
}

export function buildOpponentsByTeam(
  fixtures: { homeTeamId: string; awayTeamId: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const add = (teamId: string, opponentId: string) => {
    const list = map.get(teamId) ?? []
    list.push(opponentId)
    map.set(teamId, list)
  }
  for (const fixture of fixtures) {
    add(fixture.homeTeamId, fixture.awayTeamId)
    add(fixture.awayTeamId, fixture.homeTeamId)
  }
  return map
}
