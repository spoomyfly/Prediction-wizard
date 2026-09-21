import { describe, expect, it } from 'vitest'
import { buildOpponentsByTeam, sortStandings } from './tiebreakers'
import type { StandingsRow } from './types'

function row(partial: Partial<StandingsRow> & { teamId: string }): StandingsRow {
  return {
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    awayWins: 0,
    awayGoalsFor: 0,
    disciplinaryPoints: 0,
    clubCoefficient: 0,
    ...partial,
  }
}

describe('sortStandings', () => {
  it('orders by points first', () => {
    const rows = [row({ teamId: 'a', points: 10 }), row({ teamId: 'b', points: 15 })]
    const sorted = sortStandings(rows, [], {
      rowsByTeam: new Map(rows.map((r) => [r.teamId, r])),
      opponentsByTeam: new Map(),
      randomSalt: new Map(),
    })
    expect(sorted.map((r) => r.teamId)).toEqual(['b', 'a'])
  })

  it('breaks a points tie with goal difference then goals for', () => {
    const rows = [
      row({ teamId: 'a', points: 12, goalDifference: 3, goalsFor: 10 }),
      row({ teamId: 'b', points: 12, goalDifference: 5, goalsFor: 8 }),
      row({ teamId: 'c', points: 12, goalDifference: 5, goalsFor: 9 }),
    ]
    const sorted = sortStandings(rows, ['goal-difference', 'goals-for'], {
      rowsByTeam: new Map(rows.map((r) => [r.teamId, r])),
      opponentsByTeam: new Map(),
      randomSalt: new Map(),
    })
    // b and c both lead a on goal difference (5 > 3); between b and c, c has more goals for.
    expect(sorted.map((r) => r.teamId)).toEqual(['c', 'b', 'a'])
  })

  it('falls through the whole UEFA chain to the opponents-points-sum tiebreaker', () => {
    // a and b tied on points, goal difference, goals for, away goals, wins, away wins —
    // only their opponents' combined points totals differ.
    const a = row({ teamId: 'a', points: 12, goalDifference: 2, goalsFor: 10, wins: 3 })
    const b = row({ teamId: 'b', points: 12, goalDifference: 2, goalsFor: 10, wins: 3 })
    const oppStrong = row({ teamId: 'strong', points: 20 })
    const oppWeak = row({ teamId: 'weak', points: 4 })

    const rows = [a, b, oppStrong, oppWeak]
    const opponentsByTeam = buildOpponentsByTeam([
      { homeTeamId: 'a', awayTeamId: 'strong' },
      { homeTeamId: 'b', awayTeamId: 'weak' },
    ])

    const sorted = sortStandings(
      [a, b],
      [
        'goal-difference',
        'goals-for',
        'away-goals',
        'wins',
        'away-wins',
        'opponents-points-sum',
      ],
      {
        rowsByTeam: new Map(rows.map((r) => [r.teamId, r])),
        opponentsByTeam,
        randomSalt: new Map(),
      },
    )
    // a played the stronger opponent (20 pts) so a ranks above b.
    expect(sorted.map((r) => r.teamId)).toEqual(['a', 'b'])
  })

  it('treats fewer disciplinary points as better', () => {
    const rows = [
      row({ teamId: 'clean', points: 9, disciplinaryPoints: 1 }),
      row({ teamId: 'dirty', points: 9, disciplinaryPoints: 5 }),
    ]
    const sorted = sortStandings(rows, ['disciplinary-points'], {
      rowsByTeam: new Map(rows.map((r) => [r.teamId, r])),
      opponentsByTeam: new Map(),
      randomSalt: new Map(),
    })
    expect(sorted.map((r) => r.teamId)).toEqual(['clean', 'dirty'])
  })

  it('uses the random tiebreaker only as an absolute last resort', () => {
    const rows = [row({ teamId: 'a', points: 5 }), row({ teamId: 'b', points: 5 })]
    const randomSalt = new Map([
      ['a', 0.9],
      ['b', 0.1],
    ])
    const sorted = sortStandings(rows, ['random'], {
      rowsByTeam: new Map(rows.map((r) => [r.teamId, r])),
      opponentsByTeam: new Map(),
      randomSalt,
    })
    expect(sorted.map((r) => r.teamId)).toEqual(['a', 'b'])
  })
})
