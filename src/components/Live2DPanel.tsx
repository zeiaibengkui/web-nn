import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import {
  ErrorOutlineRounded,
  FaceRetouchingNaturalRounded,
  ViewInArRounded,
} from '@mui/icons-material'
import { LIVE2D_MODEL_URL } from '../config/live2d'
import {
  NEUTRAL_DRIVERS,
  type Live2DDrivers,
} from '../lib/live2dMapping'
import type { CameraStatus } from '../types'

interface Live2DPanelProps {
  cameraStatus: CameraStatus
  modelReady: boolean
  faceDetected: boolean
  driversRef: React.RefObject<Live2DDrivers | null>
}

interface CubismCoreModel {
  getParameterIndex(parameterId: string): number
  setParameterValueById(
    parameterId: string,
    value: number,
    weight?: number,
  ): void
}

type LoadStatus = 'loading' | 'ready' | 'error'

const smooth = (current: number, target: number, amount: number) =>
  current + (target - current) * amount

export function Live2DPanel({
  cameraStatus,
  modelReady,
  faceDetected,
  driversRef,
}: Live2DPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let app: import('pixi.js').Application | null = null
    let model: import('pixi-live2d-display/cubism4').Live2DModel | null =
      null
    let resizeObserver: ResizeObserver | null = null
    let parameterHandler: (() => void) | null = null

    const initialize = async () => {
      try {
        setLoadStatus('loading')
        setLoadError(null)

        const [{ Application, Ticker }, { Live2DModel }] = await Promise.all([
          import('pixi.js'),
          import('pixi-live2d-display/cubism4'),
        ])

        if (disposed) return

        Live2DModel.registerTicker(Ticker)
        app = new Application({
          autoDensity: true,
          antialias: true,
          backgroundAlpha: 0,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          resizeTo: host,
        })
        host.replaceChildren(app.view as HTMLCanvasElement)

        const loadedModel = await Live2DModel.from(LIVE2D_MODEL_URL, {
          autoInteract: false,
          autoUpdate: true,
        })

        if (disposed) {
          loadedModel.destroy()
          return
        }

        model = loadedModel
        model.anchor.set(0.5, 0.5)
        app.stage.addChild(model)

        const naturalWidth = model.width
        const naturalHeight = model.height
        const fitModel = () => {
          if (!app || !model) return
          const width = app.screen.width
          const height = app.screen.height
          const scale = Math.min(
            width / Math.max(1, naturalWidth),
            height / Math.max(1, naturalHeight),
          )
          model.scale.set(scale * 0.92)
          model.position.set(width / 2, height / 2)
        }

        fitModel()
        resizeObserver = new ResizeObserver(fitModel)
        resizeObserver.observe(host)

        const drivers = { ...NEUTRAL_DRIVERS }
        parameterHandler = () => {
          if (!model) return
          const target = driversRef.current ?? NEUTRAL_DRIVERS
          const coreModel = model.internalModel.coreModel as CubismCoreModel
          const setParameter = (parameterId: string, value: number) => {
            if (coreModel.getParameterIndex(parameterId) < 0) return
            coreModel.setParameterValueById(parameterId, value, 1)
          }

          drivers.angleX = smooth(drivers.angleX, target.angleX, 0.18)
          drivers.angleY = smooth(drivers.angleY, target.angleY, 0.18)
          drivers.angleZ = smooth(drivers.angleZ, target.angleZ, 0.16)
          drivers.bodyAngleX = smooth(
            drivers.bodyAngleX,
            target.bodyAngleX,
            0.15,
          )
          drivers.bodyAngleY = smooth(
            drivers.bodyAngleY,
            target.bodyAngleY,
            0.15,
          )
          drivers.bodyAngleZ = smooth(
            drivers.bodyAngleZ,
            target.bodyAngleZ,
            0.15,
          )
          drivers.eyeLeft = smooth(drivers.eyeLeft, target.eyeLeft, 0.42)
          drivers.eyeRight = smooth(drivers.eyeRight, target.eyeRight, 0.42)
          drivers.pupilX = smooth(drivers.pupilX, target.pupilX, 0.22)
          drivers.pupilY = smooth(drivers.pupilY, target.pupilY, 0.22)
          drivers.mouthOpen = smooth(
            drivers.mouthOpen,
            target.mouthOpen,
            0.3,
          )
          drivers.mouthForm = smooth(
            drivers.mouthForm,
            target.mouthForm,
            0.2,
          )
          drivers.brow = smooth(drivers.brow, target.brow, 0.2)

          setParameter('ParamAngleX', drivers.angleX)
          setParameter('ParamAngleY', drivers.angleY)
          setParameter('ParamAngleZ', drivers.angleZ)
          setParameter('ParamBodyAngleX', drivers.bodyAngleX)
          setParameter('ParamBodyAngleY', drivers.bodyAngleY)
          setParameter('ParamBodyAngleZ', drivers.bodyAngleZ)
          setParameter('ParamEyeLOpen', drivers.eyeLeft)
          setParameter('ParamEyeROpen', drivers.eyeRight)
          setParameter('ParamEyeBallX', drivers.pupilX)
          setParameter('ParamEyeBallY', drivers.pupilY)
          setParameter('ParamMouthOpenY', drivers.mouthOpen)
          setParameter('ParamMouthForm', drivers.mouthForm)
          setParameter('ParamBrowLY', drivers.brow)
          setParameter('ParamBrowRY', drivers.brow)
        }

        model.internalModel.on('beforeModelUpdate', parameterHandler)
        setLoadStatus('ready')
      } catch (error) {
        if (disposed) return
        setLoadStatus('error')
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Live2D 模型加载失败，请检查模型地址和 Cubism Core。',
        )
      }
    }

    void initialize()

    return () => {
      disposed = true
      resizeObserver?.disconnect()

      if (model && parameterHandler) {
        model.internalModel.off('beforeModelUpdate', parameterHandler)
      }

      app?.stage.removeChildren()
      model?.destroy()
      model = null
      app?.destroy(true, {
        children: true,
        texture: true,
        baseTexture: true,
      })
      app = null
      host.replaceChildren()
    }
  }, [attempt, driversRef])

  const isDriving =
    loadStatus === 'ready' &&
    modelReady &&
    cameraStatus === 'active' &&
    faceDetected

  const statusLabel =
    loadStatus === 'loading'
      ? '模型加载中'
      : loadStatus === 'error'
        ? '加载失败'
        : isDriving
          ? '实时驱动'
          : '等待人脸'

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
            LIVE2D MAP
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', mt: 0.2 }}
          >
            <Typography variant="h2">虚拟形象</Typography>
            <Chip
              size="small"
              icon={<ViewInArRounded />}
              label="Cubism 4"
              variant="outlined"
              sx={{ '& .MuiChip-icon': { fontSize: 15 } }}
            />
          </Stack>
        </Box>
        <Chip
          size="small"
          color={
            loadStatus === 'error'
              ? 'error'
              : isDriving
                ? 'success'
                : 'default'
          }
          label={statusLabel}
          variant={isDriving || loadStatus === 'error' ? 'filled' : 'outlined'}
        />
      </Stack>

      <Box
        sx={{
          position: 'relative',
          mt: 2.5,
          width: '100%',
          height: { xs: 430, sm: 520 },
          overflow: 'hidden',
          borderRadius: 3,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Box
          ref={hostRef}
          aria-label="Live2D 虚拟形象预览"
          sx={{
            position: 'absolute',
            inset: 0,
            '& canvas': {
              display: 'block',
            },
          }}
        />

        {loadStatus === 'loading' && (
          <Stack
            spacing={1.4}
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <CircularProgress size={30} color="success" />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              正在加载 Live2D 模型…
            </Typography>
          </Stack>
        )}

        {loadStatus === 'error' && (
          <Stack
            spacing={1.6}
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              px: 3,
            }}
          >
            <ErrorOutlineRounded sx={{ fontSize: 38, color: 'error.main' }} />
            <Typography sx={{ fontWeight: 750 }}>模型没有加载成功</Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', maxWidth: 440 }}
            >
              {loadError}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setAttempt((value) => value + 1)}
            >
              重新加载
            </Button>
          </Stack>
        )}

        {loadStatus === 'ready' && (
          <Chip
            icon={<FaceRetouchingNaturalRounded />}
            size="small"
            label={isDriving ? '头部 · 眼睛 · 嘴型' : 'FaceMesh 驱动待机'}
            sx={{
              position: 'absolute',
              left: 14,
              bottom: 14,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              '& .MuiChip-icon': {
                color: isDriving ? 'success.main' : 'text.disabled',
              },
            }}
          />
        )}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          mt: 2,
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Kalidokit 解算 · 参数插值平滑
        </Typography>
        <Typography
          variant="overline"
          sx={{ color: 'text.secondary', letterSpacing: '0.04em' }}
        >
          ANGLE · EYE · MOUTH · BROW
        </Typography>
      </Stack>
    </Paper>
  )
}
