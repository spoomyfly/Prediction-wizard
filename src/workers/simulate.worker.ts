/// <reference lib="webworker" />
import { simulate } from '../engine/simulate'
import { prepareTeamStrengths, resolveTeamStrengths } from '../engine/strength'
import type { StrengthParams } from '../engine/strength'
import { defaultEloParams } from '../engine/elo'
import type { EloParams } from '../engine/elo'
import { isFootballResults } from '../engine/formats/leaguePhase'
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
  /** "Сила команд" panel overrides for the Elo rating model (K, home advantage in Elo points, form, coach boost). */
  eloOverrides?: Partial<EloParams>
}

self.onmessage = (event: MessageEvent<SimulateRequest>) => {
  const { config, teams, fixtures, results, runs, seed, strengthParams, modelOverrides, eloOverrides } =
    event.data

  try {
    // Football competitions replay their played results through the Elo model
    // first (current rating + form + coach-change uncertainty); anything else
    // (e.g. Dota series) just goes straight to the attack/defense stage.
    const effectiveTeams = isFootballResults(results)
      ? prepareTeamStrengths(
          teams,
          fixtures,
          results,
          { ...defaultEloParams, ...eloOverrides },
          strengthParams,
        ).teams
      : resolveTeamStrengths(teams, strengthParams)
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
