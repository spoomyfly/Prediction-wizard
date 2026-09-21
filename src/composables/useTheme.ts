import { ref, watchEffect } from 'vue'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tournament-sim-theme'

function readStored(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to system.
  }
  return 'system'
}

const theme = ref<ThemePreference>(readStored())

watchEffect(() => {
  if (theme.value === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme.value)
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme.value)
  } catch {
    // Ignore write failures — theme just won't persist across reloads.
  }
})

export function useTheme() {
  function cycle() {
    theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
  }
  return { theme, cycle }
}
