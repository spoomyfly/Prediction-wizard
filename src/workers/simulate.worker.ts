/// <reference lib="webworker" />
import { simulate } from '../engine/simulate'
import type {
  CompetitionConfig,
  Fixture,
  MatchResult,
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
}

self.onmessage = (event: MessageEvent<SimulateRequest>) => {
  const { config, teams, fixtures, results, runs, seed } = event.data

  try {
    const result = simulate(config, teams, fixtures, results, runs, {
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
