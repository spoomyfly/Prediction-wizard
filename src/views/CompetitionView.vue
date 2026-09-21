<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getCompetition } from '../competitions'
import { useSimulationStore } from '../stores/simulation'
import { computeStandings } from '../engine/formats/leaguePhase'
import { buildOpponentsByTeam, sortStandings } from '../engine/tiebreakers'
import type { FootballResult } from '../engine/types'
import RunControls from '../components/RunControls.vue'
import PositionHeatmap from '../components/PositionHeatmap.vue'

const props = defineProps<{ competitionId: string }>()

const config = computed(() => getCompetition(props.competitionId))
const store = useSimulationStore()
const state = computed(() => store.stateFor(props.competitionId))
const selectedRuns = ref(10000)

const isLeaguePhase = computed(() => config.value?.format.type === 'league-phase')

onMounted(() => {
  store.ensureData(props.competitionId).catch(() => {
    /* surfaced via state.errorMessage */
  })
})

async function handleRun(runs: number) {
  await store.runSimulation(props.competitionId, runs).catch(() => {
    /* surfaced via state.errorMessage */
  })
}

const currentStandings = computed(() => {
  const data = state.value.data
  if (!data || !config.value || config.value.sport !== 'football') return []
  const results = data.results as FootballResult[]
  const rows = computeStandings(data.teams, data.fixtures, results)
  const rowsByTeam = new Map(rows.map((r) => [r.teamId, r]))
  const opponentsByTeam = buildOpponentsByTeam(data.fixtures)
  return sortStandings(rows, config.value.tiebreakers, {
    rowsByTeam,
    opponentsByTeam,
    randomSalt: new Map(),
  })
})

const teamNameById = computed(() => new Map((state.value.data?.teams ?? []).map((t) => [t.id, t.name])))

const resultByTeam = computed(() => {
  const result = state.value.result
  if (!result) return new Map()
  return new Map(result.teams.map((t) => [t.teamId, t]))
})

// Simulation results ordered by expected position, so the table matches
// the heatmap's row order once a run has completed.
const orderedTeamIds = computed(() => {
  if (state.value.result) {
    return [...state.value.result.teams]
      .sort((a, b) => a.expectedPosition - b.expectedPosition)
      .map((t) => t.teamId)
  }
  return currentStandings.value.map((r) => r.teamId)
})
</script>

<template>
  <section v-if="!config">
    <p>Турнир «{{ competitionId }}» не найден.</p>
    <RouterLink to="/">На главную</RouterLink>
  </section>

  <section v-else>
    <p class="breadcrumb"><RouterLink to="/">&larr; Все турниры</RouterLink></p>
    <div class="title-row">
      <h1>{{ config.name }}</h1>
      <RouterLink class="btn" :to="`/${config.id}/strength`">Сила команд</RouterLink>
    </div>
    <p class="muted">{{ config.season }} · {{ config.description }}</p>

    <p v-if="state.status === 'loading-data'" class="muted">Загрузка данных турнира…</p>
    <p v-else-if="state.status === 'error' && !state.data" class="error">
      Ошибка загрузки данных: {{ state.errorMessage }}
    </p>

    <template v-else-if="!isLeaguePhase">
      <div class="card notice">
        Формат «{{ config.format.type }}» пока не реализован в движке симуляции (см. TODO в
        <code>engine/formats/</code>). Доступна только страница
        <RouterLink :to="`/${config.id}/strength`">«Сила команд»</RouterLink> с текущими рейтингами.
      </div>
    </template>

    <template v-else-if="state.data">
      <RunControls v-model:runs="selectedRuns" :state="state" @run="handleRun" />

      <div class="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Команда</th>
              <th>Очки</th>
              <th v-for="zone in config.zones" :key="zone.id">{{ zone.label }}</th>
              <th>Ожид. место</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(teamId, index) in orderedTeamIds" :key="teamId">
              <td>{{ index + 1 }}</td>
              <td>{{ teamNameById.get(teamId) ?? teamId }}</td>
              <td>{{ currentStandings.find((r) => r.teamId === teamId)?.points ?? '—' }}</td>
              <td v-for="zone in config.zones" :key="zone.id">
                <span v-if="resultByTeam.get(teamId)">
                  {{ ((resultByTeam.get(teamId)!.zoneProbabilities[zone.id] ?? 0) * 100).toFixed(0) }}%
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span v-if="resultByTeam.get(teamId)">{{ resultByTeam.get(teamId)!.expectedPosition.toFixed(1) }}</span>
                <span v-else class="muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="!state.result" class="muted hint">
        Таблица выше показывает текущие очки. Нажмите «Пересчитать», чтобы получить вероятности
        зон и ожидаемое место.
      </p>

      <PositionHeatmap
        v-if="state.result"
        :teams="state.data.teams.map((t) => ({ teamId: t.id, name: t.name }))"
        :results="state.result.teams"
        :runs="state.result.runs"
        :zones="config.zones"
      />
    </template>
  </section>
</template>

<style scoped>
.breadcrumb {
  margin: 0 0 8px;
  font-size: 0.9rem;
}
.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
}
.notice {
  padding: 16px;
  margin-top: 12px;
}
.error {
  color: var(--danger);
}
.hint {
  font-size: 0.85rem;
  margin-top: 8px;
}
</style>
