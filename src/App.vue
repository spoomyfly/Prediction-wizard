<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from './composables/useTheme'

const { theme, cycle } = useTheme()

const themeLabel: Record<string, string> = {
  system: 'Системная',
  light: 'Светлая',
  dark: 'Тёмная',
}
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand">Симулятор турниров</RouterLink>
      <nav class="nav">
        <RouterLink to="/about">О методологии</RouterLink>
        <button class="btn theme-toggle" type="button" @click="cycle" :title="'Тема: ' + themeLabel[theme]">
          {{ themeLabel[theme] }}
        </button>
      </nav>
    </div>
  </header>

  <main class="container main">
    <RouterView />
  </main>

  <footer class="site-footer">
    <div class="container muted">
      Симуляция методом Монте-Карло. Данные и результаты — иллюстративные, см.
      <RouterLink to="/about">методологию</RouterLink>.
    </div>
  </footer>
</template>

<style scoped>
.site-header {
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.brand {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--fg);
}
.brand:hover {
  text-decoration: none;
}
.nav {
  display: flex;
  align-items: center;
  gap: 14px;
}
.theme-toggle {
  padding: 6px 10px;
  font-size: 0.85rem;
}
.main {
  flex: 1;
  padding-top: 20px;
  padding-bottom: 32px;
}
.site-footer {
  border-top: 1px solid var(--border);
  padding: 16px 0;
  font-size: 0.85rem;
}
</style>
