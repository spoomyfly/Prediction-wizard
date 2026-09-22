import { defineStore } from 'pinia'
import { markRaw, reactive } from 'vue'
import type { ModelDefaults, SimulationMessage, SimulationResult } from '../engine/types'
import type { TeamAdjustment } from '../engine/strength'
import type { CompetitionData } from '../data/loadCompetitionData'
import { loadCompetitionData } from '../data/loadCompetitionData'
import { getCompetition } from '../competitions'

/** Only these ModelDefaults keys are exposed as global sliders on the "Сила команд" page. */
export type ModelOverrideKey = 'avgGoals' | 'homeAdv' | 'sigma' | 'rho'
export type ModelOverrides = Partial<Pick<ModelDefaults, ModelOverrideKey>>

export interface StrengthUiState {
  /** 0 = every team collapses to equal strength, 1 = default calibration. */
  ratingInfluence: number
  modelOverrides: ModelOverrides
  teamAdjustments: Record<string, TeamAdjustment>
}

function defaultStrengthState(): StrengthUiState {
  return { ratingInfluence: 1, modelOverrides: {}, teamAdjustments: {} }
}

function strengthStorageKey(competitionId: string): string {
  return `tournament-sim:strength:${competitionId}`
}

function loadStrengthState(competitionId: string): StrengthUiState {
  try {
    const raw = localStorage.getItem(strengthStorageKey(competitionId))
    if (raw) return { ...defaultStrengthState(), ...JSON.parse(raw) }
  } catch {
    // Corrupt/unavailable storage — fall back to defaults.
  }
  return defaultStrengthState()
}

function saveStrengthState(competitionId: string, state: StrengthUiState): void {
  try {
    localStorage.setItem(strengthStorageKey(competitionId), JSON.stringify(state))
  } catch {
    // Ignore write failures — params just won't persist across reloads.
  }
}

export type SimulationStatus = 'idle' | 'loading-data' | 'running' | 'done' | 'error'

export interface CompetitionSimState {
  data?: CompetitionData
  result?: SimulationResult
  status: SimulationStatus
  progress: { completed: number; total: number }
  errorMessage?: string
  lastRuns: number
}

function freshState(): CompetitionSimState {
  return { status: 'idle', progress: { completed: 0, total: 0 }, lastRuns: 10000 }
}

// Workers are not serializable/reactive-friendly state, so they're kept
// outside the store, one per competition, recreated on each run.
const workers = new Map<string, Worker>()

export const useSimulationStore = defineStore('simulation', () => {
  const byCompetition = reactive<Record<string, CompetitionSimState>>({})
  const strengthByCompetition = reactive<Record<string, StrengthUiState>>({})

  function stateFor(competitionId: string): CompetitionSimState {
    if (!byCompetition[competitionId]) byCompetition[competitionId] = freshState()
    return byCompetition[competitionId]
  }

  function strengthFor(competitionId: string): StrengthUiState {
    if (!strengthByCompetition[competitionId]) {
      strengthByCompetition[competitionId] = loadStrengthState(competitionId)
    }
    return strengthByCompetition[competitionId]
  }

  function setRatingInfluence(competitionId: string, value: number): void {
    const strength = strengthFor(competitionId)
    strength.ratingInfluence = value
    saveStrengthState(competitionId, strength)
  }

  function setModelOverride(competitionId: string, key: ModelOverrideKey, value: number | undefined): void {
    const strength = strengthFor(competitionId)
    if (value === undefined) delete strength.modelOverrides[key]
    else strength.modelOverrides[key] = value
    saveStrengthState(competitionId, strength)
  }

  function setTeamAdjustment(competitionId: string, teamId: string, patch: TeamAdjustment): void {
    const strength = strengthFor(competitionId)
    const merged: TeamAdjustment = { ...strength.teamAdjustments[teamId], ...patch }
    if (merged.elo === undefined && !merged.adjustmentPct) {
      delete strength.teamAdjustments[teamId]
    } else {
      strength.teamAdjustments[teamId] = merged
    }
    saveStrengthState(competitionId, strength)
  }

  function resetStrength(competitionId: string): void {
    strengthByCompetition[competitionId] = defaultStrengthState()
    try {
      localStorage.removeItem(strengthStorageKey(competitionId))
    } catch {
      // Ignore — worst case the stale key lingers until next write.
    }
  }

  async function ensureData(competitionId: string): Promise<CompetitionData> {
    const state = stateFor(competitionId)
    if (state.data) return state.data
    state.status = 'loading-data'
    try {
      // markRaw: this is posted as-is to the simulation worker, and a Vue
      // reactive Proxy can't be structured-cloned by postMessage.
      state.data = markRaw(await loadCompetitionData(competitionId))
      state.status = 'idle'
      return state.data
    } catch (error) {
      state.status = 'error'
      state.errorMessage = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  async function runSimulation(competitionId: string, runs: number): Promise<void> {
    const config = getCompetition(competitionId)
    if (!config) throw new Error(`Unknown competition: ${competitionId}`)

    const state = stateFor(competitionId)
    const data = await ensureData(competitionId)

    workers.get(competitionId)?.terminate()
    const worker = new Worker(new URL('../workers/simulate.worker.ts', import.meta.url), {
      type: 'module',
    })
    workers.set(competitionId, worker)

    state.status = 'running'
    state.lastRuns = runs
    state.progress = { completed: 0, total: runs }
    state.errorMessage = undefined

    worker.onmessage = (event: MessageEvent<SimulationMessage>) => {
      const message = event.data
      if (message.type === 'progress') {
        state.progress = { completed: message.completed, total: message.total }
      } else if (message.type === 'done') {
        state.result = message.result
        state.status = 'done'
        worker.terminate()
        workers.delete(competitionId)
      } else if (message.type === 'error') {
        state.status = 'error'
        state.errorMessage = message.message
        worker.terminate()
        workers.delete(competitionId)
      }
    }
    worker.onerror = (event) => {
      state.status = 'error'
      state.errorMessage = event.message ?? 'Worker error'
      worker.terminate()
      workers.delete(competitionId)
    }

    // JSON round-trip: strength is part of a reactive() store object, and
    // nested reactive Proxies can't be structured-cloned by postMessage
    // (see the markRaw comment above — same failure mode, different data).
    const strength: StrengthUiState = JSON.parse(JSON.stringify(strengthFor(competitionId)))
    try {
      worker.postMessage({
        config,
        teams: data.teams,
        fixtures: data.fixtures,
        results: data.results,
        runs,
        seed: `${competitionId}-${runs}`,
        strengthParams: { ratingInfluence: strength.ratingInfluence, overrides: strength.teamAdjustments },
        modelOverrides: strength.modelOverrides,
      })
    } catch (error) {
      state.status = 'error'
      state.errorMessage = error instanceof Error ? error.message : String(error)
      worker.terminate()
      workers.delete(competitionId)
    }
  }

  return {
    byCompetition,
    stateFor,
    ensureData,
    runSimulation,
    strengthByCompetition,
    strengthFor,
    setRatingInfluence,
    setModelOverride,
    setTeamAdjustment,
    resetStrength,
  }
})
