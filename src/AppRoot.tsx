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
  const [urlModes] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      isEmbedMode: params.get('embed') === '1',
      isDesktopMode: params.get('desktop') === '1',
    }
  })
  const { isEmbedMode, isDesktopMode } = urlModes
  const theme = createAppTheme(mode)

  useEffect(() => {
    if (!isEmbedMode) return

    const root = document.documentElement
    const body = document.body
    const previousRootBackground = root.style.backgroundColor
    const previousBodyBackground = body.style.backgroundColor
    const previousBodyOverflow = body.style.overflow

    root.style.backgroundColor = 'transparent'
    body.style.backgroundColor = 'transparent'
    body.style.overflow = 'hidden'

    return () => {
      root.style.backgroundColor = previousRootBackground
      body.style.backgroundColor = previousBodyBackground
      body.style.overflow = previousBodyOverflow
    }
  }, [isEmbedMode])

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
        isEmbedMode={isEmbedMode}
        isDesktopMode={isDesktopMode}
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
