import { alpha, createTheme } from '@mui/material/styles'
import type { ColorMode } from './types'

const lime = '#c8f169'

export const createAppTheme = (mode: ColorMode) => {
  const isDark = mode === 'dark'
  const ink = isDark ? '#f2f6ed' : '#161a15'
  const canvas = isDark ? '#10140f' : '#f5f7f2'
  const paper = isDark ? '#191e18' : '#ffffff'
  const border = isDark ? '#2c3329' : '#e3e8dd'
  const muted = isDark ? '#a2ad9c' : '#687064'
  const sliderColor = isDark ? '#f2f6ed' : '#161a15'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: ink,
        contrastText: isDark ? '#12160f' : '#ffffff',
      },
      secondary: {
        main: lime,
        contrastText: '#12160f',
      },
      background: {
        default: canvas,
        paper,
      },
      text: {
        primary: ink,
        secondary: muted,
      },
      divider: border,
      success: {
        main: isDark ? '#9bd6a8' : '#31744f',
      },
      warning: {
        main: isDark ? '#e7bd6b' : '#a86b13',
      },
      error: {
        main: isDark ? '#ff9a88' : '#c24736',
      },
    },
    shape: {
      borderRadius: 18,
    },
    typography: {
      fontFamily:
        '"Manrope Variable", Manrope, "PingFang SC", "Microsoft YaHei", sans-serif',
      h1: {
        fontWeight: 720,
        fontSize: 'clamp(2.8rem, 5vw, 4.9rem)',
        lineHeight: 0.98,
        letterSpacing: '-0.065em',
      },
      h2: {
        fontWeight: 700,
        fontSize: 'clamp(1.5rem, 2vw, 2rem)',
        lineHeight: 1.15,
        letterSpacing: '-0.035em',
      },
      h3: {
        fontWeight: 700,
        fontSize: '1rem',
        lineHeight: 1.35,
        letterSpacing: '-0.015em',
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.7,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        fontWeight: 700,
        textTransform: 'none',
        letterSpacing: '-0.01em',
      },
      overline: {
        fontFamily:
          '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
        fontSize: '0.69rem',
        fontWeight: 600,
        lineHeight: 1.5,
        letterSpacing: '0.1em',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '#root': {
            minHeight: '100vh',
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 12,
            paddingInline: 20,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 650,
            borderRadius: 10,
          },
        },
      },
      MuiSlider: {
        styleOverrides: {
          root: {
            color: sliderColor,
          },
          rail: {
            backgroundColor: border,
            opacity: 1,
          },
          thumb: {
            boxShadow: `0 0 0 4px ${alpha(sliderColor, 0.1)}`,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            color: isDark ? '#727d6c' : '#9aa292',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              backgroundColor: alpha(ink, 0.08),
            },
          },
        },
      },
      MuiTooltip: {
        defaultProps: {
          arrow: true,
        },
      },
    },
  })
}
