<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { getCompetition } from '../competitions'
import { useSimulationStore } from '../stores/simulation'

const props = defineProps<{ competitionId: string }>()

const config = computed(() => getCompetition(props.competitionId))
const store = useSimulationStore()
const state = computed(() => store.stateFor(props.competitionId))

onMounted(() => {
  store.ensureData(props.competitionId).catch(() => {
    /* surfaced via state.errorMessage */
  })
})

const sortedTeams = computed(() => {
  const teams = state.value.data?.teams ?? []
  return [...teams].sort((a, b) => (b.elo ?? 0) - (a.elo ?? 0))
})

const isFootball = computed(() => config.value?.sport === 'football')
</script>

<template>
  <section v-if="!config">
    <p>Турнир «{{ competitionId }}» не найден.</p>
    <RouterLink to="/">На главную</RouterLink>
  </section>

  <section v-else class="strength-page">
    <p class="breadcrumb"><RouterLink :to="`/${config.id}`">&larr; {{ config.name }}</RouterLink></p>
    <h1>Сила команд — {{ config.name }}</h1>
    <p class="muted">
      Текущие рейтинги, только для чтения. Источник и дата обновления указаны ниже; настройка
      параметров модели силы пока недоступна (см. блок «Планируемые параметры»).
    </p>

    <p v-if="state.status === 'loading-data'" class="muted">Загрузка рейтингов…</p>
    <p v-else-if="state.status === 'error'" class="error">Ошибка загрузки: {{ state.errorMessage }}</p>

    <template v-else-if="state.data">
      <p class="muted source-note">
        Источник: {{ state.data.ratingsSource }} · по состоянию на {{ state.data.ratingsAsOf }}
        <span v-if="state.data.ratingsNote"> — {{ state.data.ratingsNote }}</span>
      </p>

      <div class="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Команда</th>
              <th v-if="state.data.teams[0]?.country">Страна</th>
              <th>Рейтинг Эло</th>
              <th v-if="isFootball">Атака</th>
              <th v-if="isFootball">Оборона</th>
              <th v-if="isFootball">Коэфф. УЕФА</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(team, index) in sortedTeams" :key="team.id">
              <td>{{ index + 1 }}</td>
              <td>{{ team.name }}</td>
              <td v-if="team.country">{{ team.country }}</td>
              <td>{{ team.elo?.toFixed(0) ?? '—' }}</td>
              <td v-if="isFootball">{{ team.attack?.toFixed(2) ?? '—' }}</td>
              <td v-if="isFootball">{{ team.defense?.toFixed(2) ?? '—' }}</td>
              <td v-if="isFootball">{{ team.clubCoefficient?.toFixed(1) ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="card planned-params">
      <h2>Планируемые параметры <span class="soon-badge">скоро</span></h2>
      <p class="muted">
        Ниже — предложения по настройке модели силы команд. Логика ещё не реализована; элементы
        управления отключены. Полное описание — в <code>docs/strength-params.md</code>.
      </p>

      <template v-if="isFootball">
        <h3>Глобальные (футбол)</h3>
        <fieldset disabled class="params-grid">
          <label>Источник рейтинга
            <select><option>Смешанный (ClubElo + коэффициенты)</option></select>
          </label>
          <label>Домашнее преимущество (λ×)
            <input type="range" min="1.0" max="1.3" step="0.01" value="1.15" />
          </label>
          <label>Средняя результативность
            <input type="number" value="1.4" step="0.05" />
          </label>
          <label>Шум рейтинга σ
            <input type="range" min="0" max="0.3" step="0.01" value="0.12" />
          </label>
          <label>Поправка на ничьи (ρ Диксона–Коулза)
            <input type="checkbox" />
          </label>
          <label>Затухание формы
            <input type="range" min="0" max="1" step="0.05" value="0.3" />
          </label>
        </fieldset>

        <h3>Для отдельной команды</h3>
        <fieldset disabled class="params-grid">
          <label>Ручная корректировка силы
            <input type="number" value="0" placeholder="±%" />
          </label>
          <label>Ротация в последнем туре
            <input type="checkbox" />
          </label>
        </fieldset>
      </template>

      <template v-else>
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
      </template>
    </div>
  </section>
</template>

<style scoped>
.breadcrumb {
  margin: 0 0 8px;
  font-size: 0.9rem;
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
.planned-params {
  margin-top: 24px;
  padding: 16px 18px;
}
.planned-params h2 {
  margin: 0 0 4px;
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
  gap: 12px 20px;
}
.params-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--fg-muted);
}
.params-grid input,
.params-grid select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
}
</style>
