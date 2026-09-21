import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages serves this project from https://<user>.github.io/prediction-wizard/
export default defineConfig({
  base: '/prediction-wizard/',
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
