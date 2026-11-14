import { useEffect, useState } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import App from './App'
import { createAppTheme } from './theme'
import type { ColorMode } from './types'

const COLOR_MODE_KEY = 'blinkline-color-mode'

const getInitialMode = (): ColorMode => {
  try {
    const storedMode = window.localStorage.getItem(COLOR_MODE_KEY)
    if (storedMode === 'light' || storedMode === 'dark') return storedMode
  } catch {
    // Storage can be unavailable in hardened browsing modes.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function AppRoot() {
  const [mode, setMode] = useState<ColorMode>(getInitialMode)
  const theme = createAppTheme(mode)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLOR_MODE_KEY, mode)
    } catch {
      // Theme switching still works when persistence is unavailable.
    }
    document.documentElement.style.colorScheme = mode
    document.documentElement.dataset.colorMode = mode
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'dark' ? '#10140f' : '#f5f7f2')
  }, [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App
        mode={mode}
        onToggleColorMode={() =>
          setMode((currentMode) =>
            currentMode === 'light' ? 'dark' : 'light',
          )
        }
      />
    </ThemeProvider>
  )
}
