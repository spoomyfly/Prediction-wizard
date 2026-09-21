<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TeamSimulationResult, Zone } from '../engine/types'

const props = defineProps<{
  teams: { teamId: string; name: string }[]
  results: TeamSimulationResult[]
  runs: number
  zones: Zone[]
}>()

const isOpen = ref(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

const nameById = computed(() => new Map(props.teams.map((t) => [t.teamId, t.name])))
const positionCount = computed(() => props.results[0]?.positionCounts.length ?? 0)
const positions = computed(() => Array.from({ length: positionCount.value }, (_, i) => i + 1))

const rows = computed(() =>
  [...props.results]
    .sort((a, b) => a.expectedPosition - b.expectedPosition)
    .map((r) => ({
      teamId: r.teamId,
      name: nameById.value.get(r.teamId) ?? r.teamId,
      cells: r.positionCounts.map((count) => count / props.runs),
    })),
)

function zoneForPosition(position: number): Zone | undefined {
  return props.zones.find((z) => position >= z.from && position <= z.to)
}

function cellStyle(probability: number, position: number) {
  const zone = zoneForPosition(position)
  const color = zone?.color ?? '#3b6fe0'
  const alpha = Math.min(1, Math.sqrt(probability) * 1.15)
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`,
  }
}
</script>

<template>
  <details class="card heatmap" :open="isOpen">
    <summary>Тепловая карта распределения мест</summary>
    <div class="table-scroll heatmap-scroll">
      <table>
        <thead>
          <tr>
            <th class="sticky-col">Команда</th>
            <th v-for="p in positions" :key="p">{{ p }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.teamId">
            <td class="sticky-col">{{ row.name }}</td>
            <td
              v-for="(probability, idx) in row.cells"
              :key="idx"
              :style="cellStyle(probability, idx + 1)"
              :title="`${row.name}: место ${idx + 1} — ${(probability * 100).toFixed(1)}%`"
            >
              <span v-if="probability >= 0.12">{{ Math.round(probability * 100) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<style scoped>
.heatmap {
  padding: 4px 0;
  margin-top: 16px;
}
summary {
  cursor: pointer;
  font-weight: 600;
  padding: 12px 16px;
  user-select: none;
}
.heatmap-scroll {
  padding: 0 16px 16px;
}
table {
  font-size: 0.75rem;
}
th,
td {
  padding: 3px 6px;
  text-align: center;
  white-space: nowrap;
}
th:first-child,
td:first-child {
  text-align: left;
}
.sticky-col {
  position: sticky;
  left: 0;
  background: var(--bg-elevated);
  z-index: 1;
}
</style>
