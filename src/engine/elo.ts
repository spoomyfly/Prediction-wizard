import type { Fixture, FootballResult, Team } from './types'
import { eloWinProbability } from './models/series'

export interface EloParams {
  /** Base K-factor: how many Elo points a "fully unexpected" result moves a rating. */
  kBase: number
  /** Home advantage expressed in ELO POINTS for the rating update — not to be confused
   *  with ModelDefaults.homeAdv, which is a lambda multiplier for expected goals. */
  homeAdvantageElo: number
  /** Scale K by margin of victory (a 5:0 moves ratings more than a 1:0). */
  useGoalDifference: boolean
  /** Extra K right after a coach change: 1.0 = double K on the first match, decaying after. */
  coachKBoost: number
  /** Extra per-team simulation noise right after a coach change: 0.8 = sigma x1.8, decaying. */
  coachSigmaBoost: number
  /** Decay constant (in matches) for both coach boosts. */
  coachDecayTau: number
  /** How much recent form shifts the effective rating. 0 disables form entirely. */
  formWeight: number
  /** Per-match decay for the form average: 0.75 means each older match counts 25% less. */
  formDecay: number
  /** Elo points corresponding to a maximal form value of 1.0. */
  formScale: number
  /** Below this many played matches, form is treated as unknown (0). */
  formMinMatches: number
}

export const defaultEloParams: EloParams = {
  kBase: 24,
  homeAdvantageElo: 70,
  useGoalDifference: true,
  coachKBoost: 1,
  coachSigmaBoost: 0.8,
  coachDecayTau: 3,
  formWeight: 0.5,
  formDecay: 0.75,
  formScale: 200,
  formMinMatches: 3,
}

export interface EloHistoryEntry {
  matchday: number
  fixtureId: string
  opponentId: string
  home: boolean
  /** Actual score for this team: 1 win, 0.5 draw, 0 loss. */
  score: number
  /** Elo-expected score going into the match. */
  expected: number
  delta: number
  eloAfter: number
}

export interface TeamEloState {
  teamId: string
  /** Season-start anchor from ratings.json (or the panel's override of it). */
  baseElo: number
  /** After replaying every played result. */
  currentElo: number
  matchesPlayed: number
  /** Decayed average of (actual - expected) over played matches, in [-1, 1]. 0 when unknown. */
  form: number
  /** Form expressed in Elo points (formWeight * formScale * form). */
  formElo: number
  /** What the simulation should actually use: currentElo + formElo. */
  effectiveElo: number
  /** >1 while the team is still "new coach, less predictable"; 1 otherwise. */
  sigmaMultiplier: number
  matchesSinceCoachChange?: number
  history: EloHistoryEntry[]
}

/** Elo-expected score for the home side, including home advantage in Elo points. */
export function expectedScore(
  ratingHome: number,
  ratingAway: number,
  homeAdvantageElo: number,
): number {
  return eloWinProbability(ratingHome + homeAdvantageElo, ratingAway)
}

/**
 * Margin-of-victory multiplier on K, following the World Football Elo convention:
 * 1 for a draw or one-goal win, 1.5 for two, then (11 + gd) / 8 for three or more.
 */
export function goalDifferenceMultiplier(goalDifference: number): number {
  const gd = Math.abs(goalDifference)
  if (gd <= 1) return 1
  if (gd === 2) return 1.5
  return (11 + gd) / 8
}

function coachDecay(matchesSinceChange: number | undefined, tau: number): number {
  if (matchesSinceChange === undefined) return 0
  return Math.exp(-matchesSinceChange / tau)
}

interface MutableState {
  state: TeamEloState
  /** Residuals in chronological order, used for the form average. */
  residuals: number[]
  matchesSinceCoachChange?: number
}

/**
 * Recompute every team's current Elo by replaying all played results on top of
 * their season-start baseline.
 *
 * Current Elo is DERIVED, never stored: a match can't be applied twice, and
 * correcting an old result automatically fixes everything downstream. Pure and
 * deterministic — same inputs always give the same ratings.
 *
 * Note this deliberately breaks classic Elo's zero-sum property: when only one
 * side has a freshly changed coach, that side's rating moves further than its
 * opponent's. K here expresses *confidence in the rating*, which is per team,
 * not a conserved quantity.
 */
export function replayElo(
  teams: Team[],
  fixtures: Fixture[],
  results: FootballResult[],
  params: EloParams,
): Map<string, TeamEloState> {
  const states = new Map<string, MutableState>()
  for (const team of teams) {
    const baseElo = team.elo ?? 1500
    states.set(team.id, {
      state: {
        teamId: team.id,
        baseElo,
        currentElo: baseElo,
        matchesPlayed: 0,
        form: 0,
        formElo: 0,
        effectiveElo: baseElo,
        sigmaMultiplier: 1,
        matchesSinceCoachChange: undefined,
        history: [],
      },
      residuals: [],
      matchesSinceCoachChange: undefined,
    })
  }

  const fixtureById = new Map(fixtures.map((f) => [f.id, f]))
  const fixtureOrder = new Map(fixtures.map((f, i) => [f.id, i]))
  const played = results
    .map((result) => ({ result, fixture: fixtureById.get(result.fixtureId) }))
    .filter((entry): entry is { result: FootballResult; fixture: Fixture } => entry.fixture !== undefined)
    .sort((a, b) => {
      if (a.fixture.matchday !== b.fixture.matchday) return a.fixture.matchday - b.fixture.matchday
      return (fixtureOrder.get(a.fixture.id) ?? 0) - (fixtureOrder.get(b.fixture.id) ?? 0)
    })

  const coachChangeMatchday = new Map(
    teams
      .filter((t) => t.coachChangedBeforeMatchday !== undefined)
      .map((t) => [t.id, t.coachChangedBeforeMatchday as number]),
  )

  for (const { result, fixture } of played) {
    const home = states.get(fixture.homeTeamId)
    const away = states.get(fixture.awayTeamId)
    if (!home || !away) continue

    const expectedHome = expectedScore(
      home.state.currentElo,
      away.state.currentElo,
      params.homeAdvantageElo,
    )
    const scoreHome = result.homeGoals > result.awayGoals ? 1 : result.homeGoals === result.awayGoals ? 0.5 : 0
    const marginMultiplier = params.useGoalDifference
      ? goalDifferenceMultiplier(result.homeGoals - result.awayGoals)
      : 1

    for (const [side, opponent, score, expected, isHome] of [
      [home, away, scoreHome, expectedHome, true],
      [away, home, 1 - scoreHome, 1 - expectedHome, false],
    ] as [MutableState, MutableState, number, number, boolean][]) {
      const changedBefore = coachChangeMatchday.get(side.state.teamId)
      if (changedBefore !== undefined && fixture.matchday >= changedBefore) {
        side.matchesSinceCoachChange = side.matchesSinceCoachChange ?? 0
      }

      const k =
        params.kBase *
        (1 + params.coachKBoost * coachDecay(side.matchesSinceCoachChange, params.coachDecayTau))
      const delta = k * marginMultiplier * (score - expected)

      side.state.currentElo += delta
      side.state.matchesPlayed++
      side.residuals.push(score - expected)
      side.state.history.push({
        matchday: fixture.matchday,
        fixtureId: fixture.id,
        opponentId: opponent.state.teamId,
        home: isHome,
        score,
        expected,
        delta,
        eloAfter: side.state.currentElo,
      })

      if (side.matchesSinceCoachChange !== undefined) side.matchesSinceCoachChange++
    }
  }

  // Finalize: form (decayed residual average), form-adjusted rating, and the
  // per-team noise multiplier a recent coach change leaves behind.
  const finalized = new Map<string, TeamEloState>()
  for (const [teamId, mutable] of states) {
    const { state, residuals } = mutable

    if (residuals.length >= params.formMinMatches && params.formWeight > 0) {
      let weightedSum = 0
      let weightTotal = 0
      // age 0 = most recent match
      for (let i = residuals.length - 1, age = 0; i >= 0; i--, age++) {
        const weight = Math.pow(params.formDecay, age)
        weightedSum += weight * residuals[i]
        weightTotal += weight
      }
      state.form = weightTotal > 0 ? weightedSum / weightTotal : 0
    }

    state.formElo = params.formWeight * params.formScale * state.form
    state.effectiveElo = state.currentElo + state.formElo

    const changedBefore = coachChangeMatchday.get(teamId)
    if (changedBefore !== undefined) {
      // A change announced for a matchday that hasn't been played yet still counts
      // as "brand new coach" (zero matches of evidence so far).
      const matchesSince = mutable.matchesSinceCoachChange ?? 0
      state.matchesSinceCoachChange = matchesSince
      state.sigmaMultiplier =
        1 + params.coachSigmaBoost * coachDecay(matchesSince, params.coachDecayTau)
    }

    finalized.set(teamId, state)
  }

  return finalized
}

/**
 * Apply replayed ratings back onto the team list: `elo` becomes the
 * form-adjusted current rating (what the simulation should use) and
 * `sigmaMultiplier` carries the coach-change uncertainty bump.
 */
export function applyEloStates(teams: Team[], states: Map<string, TeamEloState>): Team[] {
  return teams.map((team) => {
    const state = states.get(team.id)
    if (!state) return team
    return { ...team, elo: state.effectiveElo, sigmaMultiplier: state.sigmaMultiplier }
  })
}
