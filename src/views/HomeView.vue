<script setup lang="ts">
import { competitions } from '../competitions'
import CompetitionCard from '../components/CompetitionCard.vue'
</script>

<template>
  <section>
    <h1>Выберите турнир</h1>
    <p class="muted intro">
      Симуляция методом Монте-Карло: вероятности итоговых мест каждой команды по 10 000 случайных
      прогонов турнира (можно изменить количество прогонов на странице турнира).
    </p>
    <div class="grid">
      <CompetitionCard v-for="config in competitions" :key="config.id" :config="config" />
    </div>
  </section>
</template>

<style scoped>
h1 {
  margin: 0 0 6px;
}
.intro {
  margin: 0 0 20px;
  max-width: 60ch;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
</style>
