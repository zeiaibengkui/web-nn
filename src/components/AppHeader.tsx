import { Box, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import {
  DarkModeRounded,
  LightModeRounded,
  ShieldRounded,
  VisibilityRounded,
} from '@mui/icons-material'
import type { ColorMode } from '../types'

interface AppHeaderProps {
  mode: ColorMode
  onToggleColorMode: () => void
}

export function AppHeader({ mode, onToggleColorMode }: AppHeaderProps) {
  const isDark = mode === 'dark'

  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: { xs: 2, md: 2.5 },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '13px',
            bgcolor: isDark ? 'secondary.main' : 'primary.main',
            color: isDark ? 'secondary.contrastText' : 'secondary.main',
          }}
        >
          <VisibilityRounded fontSize="small" />
        </Box>
        <Typography
          sx={{
            fontSize: '1.05rem',
            fontWeight: 800,
            letterSpacing: '-0.035em',
          }}
        >
          Blinkline
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Chip
          icon={<ShieldRounded />}
          label="画面仅在本机处理"
          variant="outlined"
          sx={{
            display: { xs: 'none', sm: 'flex' },
            bgcolor: 'background.paper',
            borderColor: 'divider',
            color: 'text.secondary',
            '& .MuiChip-icon': {
              color: 'success.main',
              fontSize: 17,
            },
          }}
        />
        <Tooltip title={isDark ? '切换到浅色模式' : '切换到深色模式'}>
          <IconButton
            onClick={onToggleColorMode}
            aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
            sx={{
              width: 40,
              height: 40,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              color: 'text.primary',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {isDark ? (
              <LightModeRounded fontSize="small" />
            ) : (
              <DarkModeRounded fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  )
}
