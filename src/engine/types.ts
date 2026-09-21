// Core types shared by the simulation engine. Kept free of any Vue
// dependency so the engine can run standalone (including inside a Web Worker).

export type Sport = 'football' | 'dota2'

export type MatchModel = 'poisson-goals' | 'bo-series'

export type FormatId = 'league-phase' | 'swiss' | 'groups' | 'double-elim'

export type TiebreakerId =
  | 'goal-difference'
  | 'goals-for'
  | 'away-goals'
  | 'wins'
  | 'away-wins'
  | 'opponents-points-sum'
  | 'opponents-goal-difference-sum'
  | 'opponents-goals-for-sum'
  | 'disciplinary-points'
  | 'club-coefficient'
  | 'head-to-head-points'
  | 'random'

export interface Team {
  id: string
  name: string
  shortName?: string
  country?: string
  /** Attack strength multiplier around 1.0 (football, poisson model). */
  attack?: number
  /** Defense strength multiplier around 1.0 (football, poisson model — lower is better). */
  defense?: number
  /** Elo-style rating (used directly by the bo-series model, and as a fallback source for attack/defense). */
  elo?: number
  /** Extra points added to the standings before any match is played (e.g. club coefficient tie-break input). */
  clubCoefficient?: number
  /** Disciplinary points accumulated so far (lower is better, used only as a tiebreaker). */
  disciplinaryPoints?: number
}

export interface Fixture {
  id: string
  matchday: number
  homeTeamId: string
  awayTeamId: string
}

/** Football result: final score. */
export interface FootballResult {
  fixtureId: string
  homeGoals: number
  awayGoals: number
}

/** Dota-style series result: map wins per side. */
export interface SeriesResult {
  fixtureId: string
  homeMapWins: number
  awayMapWins: number
}

export type MatchResult = FootballResult | SeriesResult

export interface Zone {
  id: string
  label: string
  from: number
  to: number
  color: string
}

export interface ModelDefaults {
  /** Average goals per team per match, used as the Poisson baseline. */
  avgGoals?: number
  /** Home advantage multiplier applied to the home team's expected goals. */
  homeAdv?: number
  /** Rating noise (std dev) added per simulation run to reflect estimate uncertainty. */
  sigma?: number
  /** Dixon-Coles low-score correlation parameter. 0 disables the correction. */
  rho?: number
  /** Best-of length for series-based sports (1, 2, 3, 5). */
  bestOf?: number
  [key: string]: number | undefined
}

export interface FormatSpec {
  type: FormatId
  /** Number of matches each team plays in this phase (round-robin-like formats). */
  matchesPerTeam?: number
}

export interface CompetitionConfig {
  id: string
  name: string
  sport: Sport
  season: string
  format: FormatSpec
  matchModel: MatchModel
  tiebreakers: TiebreakerId[]
  zones: Zone[]
  modelDefaults: ModelDefaults
  /** Short description shown on the home page card. */
  description?: string
}

export interface StandingsRow {
  teamId: string
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  awayWins: number
  awayGoalsFor: number
  disciplinaryPoints: number
  clubCoefficient: number
}

/** Per-team outcome distribution produced by the Monte Carlo engine. */
export interface TeamSimulationResult {
  teamId: string
  /** positionCounts[i] = number of runs where the team finished in place i+1. */
  positionCounts: number[]
  /** Probability of finishing in each configured zone, keyed by zone id. */
  zoneProbabilities: Record<string, number>
  expectedPoints: number
  expectedPosition: number
}

export interface SimulationResult {
  competitionId: string
  runs: number
  seed: number
  durationMs: number
  teams: TeamSimulationResult[]
}

export interface SimulationProgress {
  type: 'progress'
  completed: number
  total: number
}

export interface SimulationDone {
  type: 'done'
  result: SimulationResult
}

export interface SimulationError {
  type: 'error'
  message: string
}

export type SimulationMessage = SimulationProgress | SimulationDone | SimulationError
