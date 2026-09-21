import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// GitHub Pages serves this project from https://<user>.github.io/Prediction-wizard/
// (must match the repo name's exact case — GitHub Pages routing is case-sensitive,
// and this repo's canonical name is "Prediction-wizard", not "prediction-wizard").
export default defineConfig({
  base: '/Prediction-wizard/',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
