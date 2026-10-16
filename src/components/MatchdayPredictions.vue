<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MatchPrediction } from '../engine/types'

const props = defineProps<{
  matches: MatchPrediction[]
  teamNameById: Map<string, string>
  runs: number
  /** The first matchday that still has something left to play. */
  defaultMatchday?: number
}>()

const matchdays = computed(() =>
  [...new Set(props.matches.map((m) => m.matchday))].sort((a, b) => a - b),
)

const selected = ref<number | undefined>(props.defaultMatchday ?? matchdays.value[0])

// A new run can shift which matchdays are left (a tour gets played, or the
// user switches competition), so keep the selection on something that exists.
watch(
  matchdays,
  (days) => {
    if (selected.value === undefined || !days.includes(selected.value)) {
      selected.value = props.defaultMatchday ?? days[0]
    }
  },
  { immediate: true },
)

const shown = computed(() =>
  props.matches
    .filter((m) => m.matchday === selected.value)
    .sort((a, b) => b.homeWin + b.awayWin - (a.homeWin + a.awayWin)),
)

const name = (id: string) => props.teamNameById.get(id) ?? id
const pct = (v: number) => (v * 100).toFixed(v >= 0.095 ? 0 : 1)

/** The side the model favours, or null when the match is too close to call. */
function pick(match: MatchPrediction): 'home' | 'draw' | 'away' {
  const max = Math.max(match.homeWin, match.draw, match.awayWin)
  if (max === match.homeWin) return 'home'
  if (max === match.awayWin) return 'away'
  return 'draw'
}
</script>

<template>
  <section class="card predictions">
    <header>
      <h2>Прогноз на тур</h2>
      <div class="days">
        <button
          v-for="day in matchdays"
          :key="day"
          type="button"
          class="day"
          :aria-pressed="day === selected"
          @click="selected = day"
        >
          {{ day }}
        </button>
      </div>
    </header>

    <p class="muted hint">
      Вероятности по {{ runs.toLocaleString('ru-RU') }} прогонам того же расчёта, что и таблица:
      с тем же шумом рейтинга, поэтому числа согласованы между собой.
    </p>

    <ul class="list">
      <li v-for="match in shown" :key="match.fixtureId" class="match">
        <div class="teams">
          <span class="side home" :class="{ fav: pick(match) === 'home' }">{{ name(match.homeTeamId) }}</span>
          <span class="xg">{{ match.expectedHomeGoals.toFixed(2) }} : {{ match.expectedAwayGoals.toFixed(2) }}</span>
          <span class="side away" :class="{ fav: pick(match) === 'away' }">{{ name(match.awayTeamId) }}</span>
        </div>

        <div class="bar" role="img"
             :aria-label="`П1 ${pct(match.homeWin)}%, ничья ${pct(match.draw)}%, П2 ${pct(match.awayWin)}%`">
          <i class="s-home" :style="{ width: `${match.homeWin * 100}%` }"></i>
          <i class="s-draw" :style="{ width: `${match.draw * 100}%` }"></i>
          <i class="s-away" :style="{ width: `${match.awayWin * 100}%` }"></i>
        </div>

        <div class="figs">
          <span>П1 {{ pct(match.homeWin) }}%</span>
          <span>Х {{ pct(match.draw) }}%</span>
          <span>П2 {{ pct(match.awayWin) }}%</span>
        </div>

        <div class="scores">
          <span class="label">Вероятные счета</span>
          <span v-for="s in match.topScorelines" :key="`${s.homeGoals}-${s.awayGoals}`" class="score">
            {{ s.homeGoals }}:{{ s.awayGoals }}
            <small>{{ pct(s.probability) }}%</small>
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.predictions {
  padding: 16px;
  margin-top: 16px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
h2 {
  margin: 0;
  font-size: 1.1rem;
}
.days {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.day {
  min-width: 34px;
  padding: 4px 9px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--fg-muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  cursor: pointer;
}
.day[aria-pressed='true'] {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}
.hint {
  font-size: 0.85rem;
  margin: 8px 0 14px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.match {
  min-width: 0;
  padding: 11px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.teams {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}
.side {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.95rem;
}
.side.home {
  text-align: right;
}
.side.fav {
  font-weight: 600;
}
.xg {
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
  color: var(--fg-muted);
  white-space: nowrap;
}
.bar {
  display: flex;
  height: 7px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--border);
}
.bar i {
  display: block;
}
.s-home {
  background: var(--accent);
}
.s-draw {
  background: var(--fg-muted);
}
.s-away {
  background: var(--warning);
}
.figs {
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: var(--fg-muted);
}
.scores {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.scores .label {
  color: var(--fg-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.score small {
  color: var(--fg-muted);
}
</style>
