import {
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import {
  AdsClickRounded,
  MyLocationRounded,
  RestartAltRounded,
  TrackChangesRounded,
} from '@mui/icons-material'
import type { CameraStatus, ColorMode } from '../types'
import type { GazePoint } from '../lib/gazeEstimation'

interface GazePanelProps {
  cameraStatus: CameraStatus
  modelReady: boolean
  isCalibrated: boolean
  gazePoint: GazePoint | null
  showCursor: boolean
  colorMode: ColorMode
  onStartCalibration: () => void
  onClearCalibration: () => void
  onToggleCursor: (value: boolean) => void
}

export function GazePanel({
  cameraStatus,
  modelReady,
  isCalibrated,
  gazePoint,
  showCursor,
  colorMode,
  onStartCalibration,
  onClearCalibration,
  onToggleCursor,
}: GazePanelProps) {
  const isActive = cameraStatus === 'active'
  const status = !modelReady
    ? { label: '模型加载中', color: 'default' as const }
    : !isActive
      ? { label: '等待摄像头', color: 'default' as const }
      : !isCalibrated
        ? { label: '需要校准', color: 'warning' as const }
        : gazePoint
          ? { label: '视线追踪中', color: 'success' as const }
          : { label: '等待视线', color: 'warning' as const }

  return (
    <Paper
      component="section"
      sx={{
        p: { xs: 2.5, sm: 3 },
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            GAZE MAP
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', mt: 0.2 }}
          >
            <Typography variant="h2">视线落点</Typography>
            <Chip
              size="small"
              label="近似"
              variant="outlined"
              sx={{ fontSize: '0.68rem' }}
            />
          </Stack>
        </Box>
        <Chip
          size="small"
          label={status.label}
          color={status.color}
          variant={status.color === 'default' ? 'outlined' : 'filled'}
        />
      </Stack>

      <Box
        sx={{
          position: 'relative',
          mt: 2.5,
          aspectRatio: '16 / 7.5',
          minHeight: 220,
          overflow: 'hidden',
          borderRadius: 3,
          border: 1,
          borderColor: 'divider',
          bgcolor: colorMode === 'dark' ? '#111510' : '#f3f5f0',
        }}
        aria-label={
          gazePoint
            ? `估计视线位置，横向 ${Math.round(gazePoint.x * 100)}%，纵向 ${Math.round(gazePoint.y * 100)}%`
            : '视线位置预览'
        }
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
          }}
        >
          {Array.from({ length: 9 }, (_, index) => (
            <Box
              key={index}
              sx={{
                borderRight: index % 3 === 2 ? 0 : 1,
                borderBottom: index >= 6 ? 0 : 1,
                borderColor: 'divider',
              }}
            />
          ))}
        </Box>

        {!isCalibrated &&
          [1, 3, 4, 5, 7].map((index) => (
            <TrackChangesRounded
              key={index}
              sx={{
                position: 'absolute',
                left: `${((index % 3) + 0.5) * (100 / 3)}%`,
                top: `${(Math.floor(index / 3) + 0.5) * (100 / 3)}%`,
                transform: 'translate(-50%, -50%)',
                color: 'text.disabled',
                fontSize: 18,
              }}
            />
          ))}

        {isCalibrated && gazePoint && (
          <>
            <Box
              sx={{
                position: 'absolute',
                left: `${gazePoint.x * 100}%`,
                top: `${gazePoint.y * 100}%`,
                width: 12,
                height: 12,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                bgcolor: 'secondary.main',
                boxShadow: 3,
                transition: 'left 80ms linear, top 80ms linear',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: `${gazePoint.x * 100}%`,
                top: `${gazePoint.y * 100}%`,
                width: 34,
                height: 34,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: 1,
                borderColor: 'secondary.main',
                bgcolor: 'transparent',
                transition: 'left 80ms linear, top 80ms linear',
              }}
            />
          </>
        )}

        {!isActive && (
          <Stack
            spacing={1}
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 3,
            }}
          >
            <MyLocationRounded sx={{ color: 'text.disabled', fontSize: 34 }} />
            <Typography sx={{ fontWeight: 750 }}>先开启摄像头</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              摄像头就绪后，通过 9 点校准建立你的个人视线映射。
            </Typography>
          </Stack>
        )}

        {isActive && !isCalibrated && (
          <Stack
            spacing={1.2}
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 3,
              bgcolor: 'background.paper',
            }}
          >
            <AdsClickRounded sx={{ color: 'success.main', fontSize: 36 }} />
            <Typography sx={{ fontWeight: 750 }}>
              校准后显示估计落点
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              保持平时使用电脑时的坐姿和观看距离。
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={onStartCalibration}
              sx={{ mt: 0.5 }}
            >
              开始 9 点校准
            </Button>
          </Stack>
        )}

        {isActive && isCalibrated && !gazePoint && (
          <Chip
            size="small"
            label="请保持正脸并看向屏幕"
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: 14,
              transform: 'translateX(-50%)',
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
            }}
          />
        )}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          mt: 2,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button
            variant={isCalibrated ? 'outlined' : 'contained'}
            startIcon={
              isCalibrated ? <RestartAltRounded /> : <AdsClickRounded />
            }
            onClick={onStartCalibration}
            disabled={!isActive || !modelReady}
          >
            {isCalibrated ? '重新校准' : '校准视线'}
          </Button>
          {isCalibrated && (
            <Button color="inherit" size="small" onClick={onClearCalibration}>
              清除
            </Button>
          )}
        </Stack>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showCursor}
              onChange={(event) => onToggleCursor(event.target.checked)}
              disabled={!isCalibrated}
            />
          }
          label={
            <Typography variant="body2" sx={{ fontWeight: 650 }}>
              全屏光标
            </Typography>
          }
        />
      </Stack>

      <Divider sx={{ my: 2 }} />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        基于虹膜位置和头部姿态校准，仅代表大致注视区域。移动、改变坐姿或窗口尺寸后建议重新校准。
      </Typography>
    </Paper>
  )
}
