/// <reference lib="webworker" />
import { simulate } from '../engine/simulate'
import { resolveTeamStrengths } from '../engine/strength'
import type { StrengthParams } from '../engine/strength'
import type {
  CompetitionConfig,
  Fixture,
  MatchResult,
  ModelDefaults,
  SimulationError,
  SimulationMessage,
  Team,
} from '../engine/types'

export interface SimulateRequest {
  config: CompetitionConfig
  teams: Team[]
  fixtures: Fixture[]
  results: MatchResult[]
  runs: number
  seed: number | string
  /** "Сила команд" panel overrides — Elo-driven attack/defense recalibration. */
  strengthParams?: StrengthParams
  /** "Сила команд" panel overrides for the global match-model sliders (avgGoals, homeAdv, sigma, rho). */
  modelOverrides?: Partial<ModelDefaults>
}

self.onmessage = (event: MessageEvent<SimulateRequest>) => {
  const { config, teams, fixtures, results, runs, seed, strengthParams, modelOverrides } = event.data

  try {
    const effectiveTeams = resolveTeamStrengths(teams, strengthParams)
    const effectiveConfig: CompetitionConfig = modelOverrides
      ? { ...config, modelDefaults: { ...config.modelDefaults, ...modelOverrides } }
      : config

    const result = simulate(effectiveConfig, effectiveTeams, fixtures, results, runs, {
      seed,
      onProgress: (completed, total) => {
        const progress: SimulationMessage = { type: 'progress', completed, total }
        self.postMessage(progress)
      },
    })
    const done: SimulationMessage = { type: 'done', result }
    self.postMessage(done)
  } catch (error) {
    const errorMessage: SimulationError = {
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(errorMessage)
  }
}
