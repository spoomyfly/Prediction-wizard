<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getCompetition } from '../competitions'
import { useSimulationStore, type EloOverrideKey, type ModelOverrideKey } from '../stores/simulation'
import { prepareTeamStrengths } from '../engine/strength'
import { defaultEloParams } from '../engine/elo'
import type { FootballResult } from '../engine/types'

const props = defineProps<{ competitionId: string }>()

const config = computed(() => getCompetition(props.competitionId))
const store = useSimulationStore()
const state = computed(() => store.stateFor(props.competitionId))
const strength = computed(() => store.strengthFor(props.competitionId))

onMounted(() => {
  store.ensureData(props.competitionId).catch(() => {
    /* surfaced via state.errorMessage */
  })
})

const isFootball = computed(() => config.value?.sport === 'football')

const eloParams = computed(() => ({ ...defaultEloParams, ...strength.value.eloOverrides }))

// Live preview: the whole strength pipeline (Elo replay + form + attack/defense)
// is pure and cheap — no Monte Carlo — so the table below updates on every
// keystroke without waiting for a simulation run.
const preview = computed(() => {
  const data = state.value.data
  if (!data || !isFootball.value) return undefined
  return prepareTeamStrengths(
    data.teams,
    data.fixtures,
    data.results as FootballResult[],
    eloParams.value,
    { ratingInfluence: strength.value.ratingInfluence, overrides: strength.value.teamAdjustments },
  )
})

const sortedTeams = computed(() => {
  const teams = preview.value?.teams ?? state.value.data?.teams ?? []
  return [...teams].sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))
})

function eloStateFor(teamId: string) {
  return preview.value?.eloStates.get(teamId)
}

// Debounced auto-recalculation of the full Monte Carlo result whenever a
// param changes: a cheap 1k-run preview while actively adjusting, and a
// proper 10k run once the user stops (mirrors native <input>/<change> —
// fires on every keystroke/drag vs. once on release/blur).
let previewTimer: ReturnType<typeof setTimeout> | undefined

function runPreview() {
  clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    store.runSimulation(props.competitionId, 1000).catch(() => {})
  }, 250)
}

function runFinal() {
  clearTimeout(previewTimer)
  store.runSimulation(props.competitionId, 10000).catch(() => {})
}

onBeforeUnmount(() => clearTimeout(previewTimer))

const globalDefaults = computed(() => {
  const defaults = config.value?.modelDefaults ?? {}
  return {
    avgGoals: defaults.avgGoals ?? 1.35,
    homeAdv: defaults.homeAdv ?? 1.15,
    sigma: defaults.sigma ?? 0.12,
    rho: defaults.rho ?? 0,
  }
})

// v-model-friendly getters/setters backed by the store, falling back to the
// competition's own config defaults when no override is set yet.
function globalValue(key: ModelOverrideKey): number {
  return strength.value.modelOverrides[key] ?? globalDefaults.value[key]
}
function setGlobal(key: ModelOverrideKey, value: number) {
  store.setModelOverride(props.competitionId, key, value)
}

const rhoEnabled = computed(() => globalValue('rho') !== 0)
function toggleRho(enabled: boolean) {
  setGlobal('rho', enabled ? 0.1 : 0)
  runPreview()
}

function onRatingInfluenceInput(value: number) {
  store.setRatingInfluence(props.competitionId, value)
  runPreview()
}

function onGlobalInput(key: ModelOverrideKey, value: number) {
  setGlobal(key, value)
  runPreview()
}

function eloValue(key: EloOverrideKey): number {
  return strength.value.eloOverrides[key] ?? defaultEloParams[key]
}
function onEloInput(key: EloOverrideKey, value: number) {
  store.setEloOverride(props.competitionId, key, value)
  runPreview()
}

function teamBaseElo(teamId: string): number | undefined {
  const override = strength.value.teamAdjustments[teamId]?.elo
  if (override !== undefined) return override
  return state.value.data?.teams.find((t) => t.id === teamId)?.elo
}
function teamAdjustmentPct(teamId: string): number {
  return (strength.value.teamAdjustments[teamId]?.adjustmentPct ?? 0) * 100
}
function teamCoachMatchday(teamId: string): number | undefined {
  return (
    strength.value.teamAdjustments[teamId]?.coachChangedBeforeMatchday ??
    state.value.data?.teams.find((t) => t.id === teamId)?.coachChangedBeforeMatchday
  )
}

function onTeamEloInput(teamId: string, value: string) {
  const num = Number(value)
  store.setTeamAdjustment(props.competitionId, teamId, { elo: Number.isFinite(num) && value !== '' ? num : undefined })
  runPreview()
}
function onTeamAdjustmentInput(teamId: string, value: string) {
  const num = Number(value)
  store.setTeamAdjustment(props.competitionId, teamId, {
    adjustmentPct: Number.isFinite(num) ? num / 100 : 0,
  })
  runPreview()
}
function onTeamCoachInput(teamId: string, value: string) {
  const num = Number(value)
  store.setTeamAdjustment(props.competitionId, teamId, {
    coachChangedBeforeMatchday: value !== '' && Number.isFinite(num) && num > 0 ? Math.round(num) : undefined,
  })
  runPreview()
}

function formLabel(teamId: string): string {
  const eloState = eloStateFor(teamId)
  if (!eloState) return '—'
  if (eloState.matchesPlayed < eloParams.value.formMinMatches) {
    return `— (${eloState.matchesPlayed}/${eloParams.value.formMinMatches})`
  }
  const sign = eloState.form > 0 ? '+' : ''
  return `${sign}${(eloState.form * 100).toFixed(0)}%`
}

function resetAll() {
  store.resetStrength(props.competitionId)
  runFinal()
}

const hasOverrides = computed(() => {
  const s = strength.value
  return (
    s.ratingInfluence !== 1 ||
    Object.keys(s.modelOverrides).length > 0 ||
    Object.keys(s.teamAdjustments).length > 0
  )
})
</script>

<template>
  <section v-if="!config">
    <p>Турнир «{{ competitionId }}» не найден.</p>
    <RouterLink to="/">На главную</RouterLink>
  </section>

  <section v-else class="strength-page">
    <p class="breadcrumb"><RouterLink :to="`/${config.id}`">&larr; {{ config.name }}</RouterLink></p>
    <div class="title-row">
      <h1>Сила команд — {{ config.name }}</h1>
      <button v-if="isFootball" class="btn" type="button" :disabled="!hasOverrides" @click="resetAll">
        Сбросить
      </button>
    </div>
    <p class="muted">
      <template v-if="isFootball">
        Настройте параметры модели ниже — таблица и (с задержкой) вероятности на странице турнира
        пересчитываются автоматически.
      </template>
      <template v-else>Текущие рейтинги, только для чтения.</template>
    </p>

    <p v-if="state.status === 'loading-data'" class="muted">Загрузка рейтингов…</p>
    <p v-else-if="state.status === 'error'" class="error">Ошибка загрузки: {{ state.errorMessage }}</p>

    <template v-else-if="state.data">
      <p class="muted source-note">
        Источник: {{ state.data.ratingsSource }} · по состоянию на {{ state.data.ratingsAsOf }}
        <span v-if="state.data.ratingsNote"> — {{ state.data.ratingsNote }}</span>
      </p>

      <div v-if="isFootball" class="card global-params">
        <h2>Глобальные параметры</h2>
        <div class="params-grid">
          <label>
            <span class="label-row">
              <span>Влияние рейтинга</span>
              <span class="value-badge">{{ strength.ratingInfluence.toFixed(2) }}</span>
            </span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              :value="strength.ratingInfluence"
              @input="onRatingInfluenceInput(+($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label>
            <span class="label-row">
              <span>Домашнее преимущество (λ×)</span>
              <span class="value-badge">{{ globalValue('homeAdv').toFixed(2) }}</span>
            </span>
            <input
              type="range"
              min="1"
              max="1.3"
              step="0.01"
              :value="globalValue('homeAdv')"
              @input="onGlobalInput('homeAdv', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label>
            Средняя результативность
            <input
              type="number"
              min="1"
              max="2.5"
              step="0.05"
              :value="globalValue('avgGoals')"
              @input="onGlobalInput('avgGoals', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label>
            <span class="label-row">
              <span>Шум рейтинга σ</span>
              <span class="value-badge">{{ globalValue('sigma').toFixed(2) }}</span>
            </span>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.01"
              :value="globalValue('sigma')"
              @input="onGlobalInput('sigma', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label class="checkbox-row">
            <span>
              <input
                type="checkbox"
                :checked="rhoEnabled"
                @change="toggleRho(($event.target as HTMLInputElement).checked); runFinal()"
              />
              Поправка на ничьи (ρ Диксона–Коулза)
            </span>
            <input
              v-if="rhoEnabled"
              type="range"
              min="-0.2"
              max="0.2"
              step="0.01"
              :value="globalValue('rho')"
              @input="onGlobalInput('rho', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
        </div>
      </div>

      <div v-if="isFootball" class="card global-params">
        <h2>Рейтинг Эло</h2>
        <p class="muted params-note">
          Текущий Эло не хранится, а пересчитывается: базовый рейтинг на старт сезона прогоняется
          через все сыгранные матчи. Форма измеряет отклонение от ожиданий Эло, поэтому не
          дублирует уже учтённые в рейтинге результаты.
        </p>
        <div class="params-grid">
          <label>
            <span class="label-row">
              <span>K — скорость изменения Эло</span>
              <span class="value-badge">{{ eloValue('kBase').toFixed(0) }}</span>
            </span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              :value="eloValue('kBase')"
              @input="onEloInput('kBase', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label>
            <span class="label-row">
              <span>Преимущество поля (очки Эло)</span>
              <span class="value-badge">{{ eloValue('homeAdvantageElo').toFixed(0) }}</span>
            </span>
            <input
              type="range"
              min="0"
              max="150"
              step="5"
              :value="eloValue('homeAdvantageElo')"
              @input="onEloInput('homeAdvantageElo', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label>
            <span class="label-row">
              <span>Вес текущей формы</span>
              <span class="value-badge">{{ eloValue('formWeight').toFixed(2) }}</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="eloValue('formWeight')"
              @input="onEloInput('formWeight', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
          <label>
            <span class="label-row">
              <span>Буст K при смене тренера</span>
              <span class="value-badge">×{{ (1 + eloValue('coachKBoost')).toFixed(1) }}</span>
            </span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              :value="eloValue('coachKBoost')"
              @input="onEloInput('coachKBoost', +($event.target as HTMLInputElement).value)"
              @change="runFinal"
            />
          </label>
        </div>
      </div>

      <div class="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Команда</th>
              <th v-if="state.data.teams[0]?.country">Страна</th>
              <th v-if="isFootball" title="Рейтинг на старт сезона — редактируемый">Базовый Эло</th>
              <th v-else>Эло</th>
              <th v-if="isFootball" title="Базовый Эло после прогона всех сыгранных матчей">Текущий</th>
              <th v-if="isFootball" title="Изменение Эло с начала сезона">Δ</th>
              <th v-if="isFootball" title="Отклонение от ожиданий Эло в последних матчах">Форма</th>
              <th v-if="isFootball" title="Номер тура, перед которым сменился тренер (пусто — не менялся)">Смена трен.</th>
              <th v-if="isFootball">Коррект. ±%</th>
              <th v-if="isFootball">Атака</th>
              <th v-if="isFootball">Оборона</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(team, index) in sortedTeams" :key="team.id">
              <td>{{ index + 1 }}</td>
              <td>{{ team.name }}</td>
              <td v-if="team.country">{{ team.country }}</td>
              <td>
                <input
                  v-if="isFootball"
                  class="cell-input"
                  type="number"
                  :value="teamBaseElo(team.id)"
                  @input="onTeamEloInput(team.id, ($event.target as HTMLInputElement).value)"
                  @change="runFinal"
                />
                <span v-else>{{ team.elo?.toFixed(0) ?? '—' }}</span>
              </td>
              <td v-if="isFootball">{{ eloStateFor(team.id)?.currentElo.toFixed(0) ?? '—' }}</td>
              <td v-if="isFootball">
                <span
                  v-if="eloStateFor(team.id)"
                  :class="{
                    'delta-up': eloStateFor(team.id)!.currentElo - eloStateFor(team.id)!.baseElo > 0.5,
                    'delta-down': eloStateFor(team.id)!.currentElo - eloStateFor(team.id)!.baseElo < -0.5,
                  }"
                >
                  {{ (eloStateFor(team.id)!.currentElo - eloStateFor(team.id)!.baseElo > 0 ? '+' : '')
                  }}{{ (eloStateFor(team.id)!.currentElo - eloStateFor(team.id)!.baseElo).toFixed(0) }}
                </span>
                <span v-else>—</span>
              </td>
              <td v-if="isFootball" class="muted-cell">{{ formLabel(team.id) }}</td>
              <td v-if="isFootball">
                <input
                  class="cell-input narrow"
                  type="number"
                  min="1"
                  max="8"
                  step="1"
                  placeholder="—"
                  :value="teamCoachMatchday(team.id) ?? ''"
                  @input="onTeamCoachInput(team.id, ($event.target as HTMLInputElement).value)"
                  @change="runFinal"
                />
              </td>
              <td v-if="isFootball">
                <input
                  class="cell-input"
                  type="number"
                  min="-30"
                  max="30"
                  step="1"
                  :value="teamAdjustmentPct(team.id)"
                  @input="onTeamAdjustmentInput(team.id, ($event.target as HTMLInputElement).value)"
                  @change="runFinal"
                />
              </td>
              <td v-if="isFootball">{{ team.attack?.toFixed(2) ?? '—' }}</td>
              <td v-if="isFootball">{{ team.defense?.toFixed(2) ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="isFootball" class="muted hint">
        <RouterLink :to="`/${config.id}`">Таблица турнира</RouterLink> обновится автоматически
        (1k сразу, 10k чуть позже) — статус пересчёта виден там же.
      </p>
    </template>

    <div v-if="!isFootball" class="card planned-params">
      <h2>Планируемые параметры <span class="soon-badge">скоро</span></h2>
      <p class="muted">
        Настройка силы команд для Dota 2 пока не реализована. Полное описание — в
        <code>docs/strength-params.md</code>.
      </p>
      <h3>Киберспорт (Dota 2)</h3>
      <fieldset disabled class="params-grid">
        <label>Вес LAN vs. онлайн
          <input type="range" min="0" max="1" step="0.05" value="0.7" />
        </label>
        <label>Сброс рейтинга при смене ростера
          <input type="checkbox" checked />
        </label>
        <label>Увеличенный σ после патча
          <input type="checkbox" />
        </label>
      </fieldset>
    </div>
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
  margin: 0 0 6px;
}
.source-note {
  margin: 4px 0 12px;
  font-size: 0.85rem;
}
.error {
  color: var(--danger);
}
.hint {
  font-size: 0.85rem;
  margin-top: 8px;
}
.global-params,
.planned-params {
  margin-bottom: 16px;
  padding: 16px 18px;
}
.global-params h2,
.planned-params h2 {
  margin: 0 0 12px;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 8px;
}
.planned-params h3 {
  font-size: 0.9rem;
  margin: 18px 0 8px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.soon-badge {
  font-size: 0.7rem;
  text-transform: uppercase;
  background: color-mix(in srgb, var(--warning) 20%, transparent);
  color: var(--warning);
  padding: 2px 8px;
  border-radius: 999px;
}
.params-grid {
  border: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px 20px;
}
.params-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--fg-muted);
}
.label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.value-badge {
  font-variant-numeric: tabular-nums;
  color: var(--fg);
  white-space: nowrap;
}
.checkbox-row span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.checkbox-row input[type='checkbox'] {
  width: auto;
}
.disabled-field {
  opacity: 0.6;
}
.params-grid input,
.params-grid select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
}
.cell-input {
  width: 64px;
  padding: 3px 5px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--fg);
}
.cell-input.narrow {
  width: 48px;
}
.params-note {
  margin: -6px 0 12px;
  font-size: 0.85rem;
  max-width: 70ch;
}
.muted-cell {
  color: var(--fg-muted);
}
.delta-up {
  color: var(--success);
}
.delta-down {
  color: var(--danger);
}
</style>
