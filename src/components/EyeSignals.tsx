import {
  Box,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { CircleRounded, PanToolAltRounded } from '@mui/icons-material'
import type { CameraStatus, EyeReadout, EyeMethod } from '../types'
import { getOpenness } from '../lib/eyeMetrics'

interface EyeSignalsProps {
  cameraStatus: CameraStatus
  readout: EyeReadout
  method: EyeMethod
  blinkCount: number
  blinkRate: string
  elapsedLabel: string
  lastBlinkLabel: string
  modelReady: boolean
  fps: number
}

const getStatus = (
  cameraStatus: CameraStatus,
  readout: EyeReadout,
  modelReady: boolean,
) => {
  if (!modelReady) {
    return { label: '模型加载中', color: 'default' as const }
  }
  if (cameraStatus === 'requesting') {
    return { label: '连接摄像头', color: 'warning' as const }
  }
  if (cameraStatus !== 'active') {
    return { label: '等待开始', color: 'default' as const }
  }
  if (!readout.hasFace) {
    return { label: '寻找人脸', color: 'warning' as const }
  }
  if (readout.isClosed) {
    return { label: '检测到眨眼', color: 'success' as const }
  }
  return { label: '双眼睁开', color: 'success' as const }
}

function EyeMeter({
  label,
  value,
  active,
}: {
  label: string
  value: number
  active: boolean
}) {
  return (
    <Box>
      <Stack
        direction="row"
        sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 0.7 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontFamily:
              '"JetBrains Mono Variable", "JetBrains Mono", monospace',
            fontSize: '0.78rem',
            color: 'text.secondary',
          }}
        >
          {active ? `${value}%` : '--'}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={active ? value : 0}
        color="success"
        sx={{
          height: 7,
          borderRadius: 99,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 99,
          },
        }}
      />
    </Box>
  )
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          fontFamily:
            '"JetBrains Mono Variable", "JetBrains Mono", monospace',
          fontSize: '0.78rem',
        }}
      >
        {value}
      </Typography>
    </Stack>
  )
}

export function EyeSignals({
  cameraStatus,
  readout,
  method,
  blinkCount,
  blinkRate,
  elapsedLabel,
  lastBlinkLabel,
  modelReady,
  fps,
}: EyeSignalsProps) {
  const status = getStatus(cameraStatus, readout, modelReady)
  const hasLiveData = cameraStatus === 'active' && readout.hasFace

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
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}
      >
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>
            SESSION
          </Typography>
          <Typography variant="h2" sx={{ mt: 0.2 }}>
            眼睛信号
          </Typography>
        </Box>
        <Chip
          size="small"
          icon={<CircleRounded sx={{ fontSize: '10px !important' }} />}
          label={status.label}
          color={status.color}
          variant={status.color === 'default' ? 'outlined' : 'filled'}
          sx={{
            mt: 0.5,
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          }}
        />
      </Stack>

      <Box sx={{ mt: 3.5, mb: 3 }}>
        <Typography
          aria-label={`眨眼次数 ${blinkCount}`}
          sx={{
            fontSize: 'clamp(4.5rem, 8vw, 6.4rem)',
            fontWeight: 720,
            lineHeight: 0.82,
            letterSpacing: '-0.08em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {String(blinkCount).padStart(2, '0')}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mt: 1.5 }}
        >
          <Typography sx={{ fontWeight: 750 }}>眨眼次数</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {lastBlinkLabel}
          </Typography>
        </Stack>
      </Box>

      <Stack spacing={2.2}>
        <EyeMeter
          label="你的左眼"
          value={getOpenness(readout, method, 'left')}
          active={hasLiveData}
        />
        <EyeMeter
          label="你的右眼"
          value={getOpenness(readout, method, 'right')}
          active={hasLiveData}
        />
      </Stack>

      <Divider sx={{ my: 2.5 }} />

      <Stack spacing={1.4}>
        <SessionMetric label="会话时长" value={elapsedLabel} />
        <SessionMetric label="眨眼频率" value={blinkRate} />
        <SessionMetric
          label="处理帧率"
          value={cameraStatus === 'active' ? `${fps || '--'} FPS` : '-- FPS'}
        />
        <SessionMetric
          label="识别方式"
          value={method === 'blendshape' ? 'BLENDSHAPE' : 'GEOMETRY'}
        />
      </Stack>

      <Box
        sx={{
          mt: 2.5,
          p: 1.5,
          display: 'flex',
          gap: 1.2,
          alignItems: 'flex-start',
          borderRadius: 2.5,
          bgcolor: 'action.hover',
        }}
      >
        <PanToolAltRounded
          sx={{ color: 'success.main', fontSize: 19, mt: 0.1 }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          自然眨眼，保持面部光线均匀。识别会在睁眼与闭眼之间连续采样。
        </Typography>
      </Box>
    </Paper>
  )
}
