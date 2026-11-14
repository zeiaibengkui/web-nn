import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import {
  AdsClickRounded,
  CloseRounded,
  ErrorOutlineRounded,
} from '@mui/icons-material'
import {
  aggregateCalibrationSamples,
  type GazeCalibrationPoint,
  type GazeFeature,
} from '../lib/gazeEstimation'

const CALIBRATION_TARGETS = [
  { x: 0.12, y: 0.16 },
  { x: 0.5, y: 0.14 },
  { x: 0.88, y: 0.16 },
  { x: 0.12, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.88, y: 0.5 },
  { x: 0.12, y: 0.84 },
  { x: 0.5, y: 0.86 },
  { x: 0.88, y: 0.84 },
] as const

type CalibrationPhase = 'preparing' | 'sampling' | 'complete' | 'error'

interface GazeCalibrationDialogProps {
  open: boolean
  latestFeatureRef: React.RefObject<GazeFeature | null>
  onComplete: (points: GazeCalibrationPoint[]) => string | null
  onClose: () => void
}

const sleep = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration))

export function GazeCalibrationDialog({
  open,
  latestFeatureRef,
  onComplete,
  onClose,
}: GazeCalibrationDialogProps) {
  const [targetIndex, setTargetIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [sampleCount, setSampleCount] = useState(0)
  const [phase, setPhase] = useState<CalibrationPhase>('preparing')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const onCompleteRef = useRef(onComplete)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCompleteRef.current = onComplete
    onCloseRef.current = onClose
  }, [onClose, onComplete])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const calibrationPoints: GazeCalibrationPoint[] = []

    const runCalibration = async () => {
      setError(null)
      setPhase('preparing')

      for (let index = 0; index < CALIBRATION_TARGETS.length; index += 1) {
        const target = CALIBRATION_TARGETS[index]
        setTargetIndex(index)
        setProgress(0)
        setSampleCount(0)
        setPhase('preparing')

        await sleep(550)
        if (cancelled) return

        setPhase('sampling')
        const features: GazeFeature[] = []
        const samplingStartedAt = performance.now()
        const samplingDuration = 1300

        while (performance.now() - samplingStartedAt < samplingDuration) {
          const feature = latestFeatureRef.current
          if (feature) {
            features.push({ ...feature })
          }

          setSampleCount(features.length)
          setProgress(
            Math.min(
              100,
              ((performance.now() - samplingStartedAt) / samplingDuration) *
                100,
            ),
          )
          await sleep(35)
          if (cancelled) return
        }

        const point = aggregateCalibrationSamples(target.x, target.y, features)
        if (point) calibrationPoints.push(point)

        setProgress(100)
        await sleep(120)
        if (cancelled) return
      }

      setPhase('complete')
      const completionError = onCompleteRef.current(calibrationPoints)

      if (completionError) {
        setPhase('error')
        setError(completionError)
        return
      }

      onCloseRef.current()
    }

    void runCalibration()

    return () => {
      cancelled = true
    }
  }, [attempt, latestFeatureRef, open])

  const target = CALIBRATION_TARGETS[targetIndex]
  const overallProgress =
    ((targetIndex + Math.min(progress, 100) / 100) /
      CALIBRATION_TARGETS.length) *
    100

  const closeCalibration = () => {
    setPhase('preparing')
    setProgress(0)
    onClose()
  }

  const retryCalibration = () => {
    setError(null)
    setAttempt((currentAttempt) => currentAttempt + 1)
  }

  return (
    <Dialog
      open={open}
      fullScreen
      onClose={closeCalibration}
      slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
    >
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack
          component="header"
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: { xs: 2.5, sm: 4 },
            py: 2,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '13px',
                bgcolor: 'secondary.main',
                color: 'secondary.contrastText',
              }}
            >
              <AdsClickRounded fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h3">视线校准</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                9 个参考点 · 约 18 秒
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={closeCalibration}
            aria-label="取消视线校准"
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <CloseRounded />
          </IconButton>
        </Stack>

        <Box sx={{ position: 'relative', flex: 1, minHeight: 480 }}>
          {phase !== 'error' && (
            <Box
              sx={{
                position: 'absolute',
                left: `${target.x * 100}%`,
                top: `${target.y * 100}%`,
                width: 30,
                height: 30,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                bgcolor: 'secondary.main',
                border: 5,
                borderColor: 'background.default',
                boxShadow: 3,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: 'secondary.contrastText',
                }}
              />
            </Box>
          )}

          {phase === 'error' && (
            <Stack
              spacing={2.5}
              sx={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
                px: 3,
                textAlign: 'center',
              }}
            >
              <ErrorOutlineRounded
                sx={{ fontSize: 48, color: 'warning.main' }}
              />
              <Box>
                <Typography variant="h2">校准没有完成</Typography>
                <Typography
                  variant="body1"
                  sx={{ mt: 1, color: 'text.secondary', maxWidth: 520 }}
                >
                  {error}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" onClick={retryCalibration}>
                  重新校准
                </Button>
                <Button variant="outlined" onClick={closeCalibration}>
                  关闭
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>

        {phase !== 'error' && (
          <Box
            component="footer"
            sx={{
              px: { xs: 2.5, sm: 4 },
              py: 2.5,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{
                alignItems: { xs: 'stretch', sm: 'center' },
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ flex: 1, maxWidth: 720 }}>
                <Stack
                  direction="row"
                  spacing={1.2}
                  sx={{ alignItems: 'center', mb: 1 }}
                >
                  <Typography sx={{ fontWeight: 750 }}>
                    {phase === 'preparing'
                      ? '看向圆点'
                      : phase === 'sampling'
                        ? '保持注视，头部自然不动'
                        : '正在建立视线模型'}
                  </Typography>
                  <Chip
                    size="small"
                    label={`${Math.min(targetIndex + 1, 9)} / 9`}
                    variant="outlined"
                  />
                  {phase === 'sampling' && sampleCount === 0 && (
                    <Chip
                      size="small"
                      color="warning"
                      label="等待双眼"
                    />
                  )}
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={overallProgress}
                  color="success"
                  sx={{
                    height: 8,
                    borderRadius: 99,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': { borderRadius: 99 },
                  }}
                />
              </Box>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
              >
                有效帧 {sampleCount}
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>
    </Dialog>
  )
}
