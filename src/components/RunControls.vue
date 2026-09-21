<script setup lang="ts">
import { computed } from 'vue'
import type { CompetitionSimState } from '../stores/simulation'

const props = defineProps<{ state: CompetitionSimState }>()
const emit = defineEmits<{ run: [runs: number] }>()

const runOptions = [
  { value: 1000, label: '1k' },
  { value: 10000, label: '10k' },
  { value: 50000, label: '50k' },
]

const selectedRuns = defineModel<number>('runs', { default: 10000 })

const isRunning = computed(() => props.state.status === 'running')
const progressPercent = computed(() => {
  const { completed, total } = props.state.progress
  return total > 0 ? Math.round((completed / total) * 100) : 0
})
const durationSeconds = computed(() =>
  props.state.result ? (props.state.result.durationMs / 1000).toFixed(2) : null,
)
</script>

<template>
  <div class="card run-controls">
    <div class="controls-row">
      <label class="runs-label">
        Прогонов:
        <select v-model.number="selectedRuns" :disabled="isRunning">
          <option v-for="opt in runOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <button class="btn btn-primary" type="button" :disabled="isRunning" @click="emit('run', selectedRuns)">
        {{ isRunning ? 'Считаем…' : 'Пересчитать' }}
      </button>
      <span v-if="durationSeconds && !isRunning" class="muted duration">
        Готово за {{ durationSeconds }} с ({{ state.result!.runs.toLocaleString('ru-RU') }} прогонов)
      </span>
    </div>

    <div v-if="isRunning" class="progress-track" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
      <span class="progress-label">{{ progressPercent }}%</span>
    </div>

    <p v-if="state.status === 'error'" class="error">Ошибка симуляции: {{ state.errorMessage }}</p>
  </div>
</template>

<style scoped>
.run-controls {
  padding: 14px 16px;
  margin-bottom: 16px;
}
.controls-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.runs-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.runs-label select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--fg);
}
.duration {
  font-size: 0.85rem;
}
.progress-track {
  position: relative;
  margin-top: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s ease;
}
.progress-label {
  position: absolute;
  right: 4px;
  top: -18px;
  font-size: 0.75rem;
  color: var(--fg-muted);
}
.error {
  color: var(--danger);
  margin: 10px 0 0;
}
</style>
