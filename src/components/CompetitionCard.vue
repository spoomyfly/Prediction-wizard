<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { CompetitionConfig } from '../engine/types'

defineProps<{ config: CompetitionConfig }>()

const sportLabel: Record<string, string> = {
  football: 'Футбол',
  dota2: 'Dota 2',
}
</script>

<template>
  <RouterLink :to="`/${config.id}`" class="card competition-card">
    <div class="card-top">
      <span class="sport-badge">{{ sportLabel[config.sport] ?? config.sport }}</span>
      <span class="muted season">{{ config.season }}</span>
    </div>
    <h2>{{ config.name }}</h2>
    <p class="muted description">{{ config.description }}</p>
  </RouterLink>
</template>

<style scoped>
.competition-card {
  display: block;
  padding: 18px;
  color: var(--fg);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.competition-card:hover {
  text-decoration: none;
  transform: translateY(-2px);
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sport-badge {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  padding: 3px 8px;
  border-radius: 999px;
}
.season {
  font-size: 0.85rem;
}
h2 {
  margin: 0 0 6px;
  font-size: 1.15rem;
}
.description {
  margin: 0;
  font-size: 0.9rem;
}
</style>
