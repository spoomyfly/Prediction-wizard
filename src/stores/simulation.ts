import { defineStore } from 'pinia'
import { markRaw, reactive } from 'vue'
import type { SimulationMessage, SimulationResult } from '../engine/types'
import type { CompetitionData } from '../data/loadCompetitionData'
import { loadCompetitionData } from '../data/loadCompetitionData'
import { getCompetition } from '../competitions'

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

  function stateFor(competitionId: string): CompetitionSimState {
    if (!byCompetition[competitionId]) byCompetition[competitionId] = freshState()
    return byCompetition[competitionId]
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

    try {
      worker.postMessage({
        config,
        teams: data.teams,
        fixtures: data.fixtures,
        results: data.results,
        runs,
        seed: `${competitionId}-${runs}`,
      })
    } catch (error) {
      state.status = 'error'
      state.errorMessage = error instanceof Error ? error.message : String(error)
      worker.terminate()
      workers.delete(competitionId)
    }
  }

  return { byCompetition, stateFor, ensureData, runSimulation }
})
