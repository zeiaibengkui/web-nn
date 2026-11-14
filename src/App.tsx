import { useEffect, useRef, useState } from 'react'
import { Box, Container, Divider, Stack, Typography } from '@mui/material'
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { AppHeader } from './components/AppHeader'
import { CameraPanel } from './components/CameraPanel'
import { DetectionSettings } from './components/DetectionSettings'
import { EyeSignals } from './components/EyeSignals'
import { GazeCalibrationDialog } from './components/GazeCalibrationDialog'
import { GazePanel } from './components/GazePanel'
import { useFaceMesh } from './hooks/useFaceMesh'
import { getEyeReadout } from './lib/eyeMetrics'
import {
  extractGazeFeature,
  fitGazeModel,
  predictGaze,
  type GazeCalibrationPoint,
  type GazeFeature,
  type GazeModel,
  type GazePoint,
} from './lib/gazeEstimation'
import { formatElapsed, formatLastBlink } from './lib/format'
import {
  EMPTY_EYE_READOUT,
  type CameraStatus,
  type ColorMode,
  type EyeMethod,
  type EyeReadout,
} from './types'

const CAMERA_ERRORS: Record<string, string> = {
  NotAllowedError: '摄像头权限被拒绝。请在浏览器地址栏中允许访问后重试。',
  NotFoundError: '没有找到可用摄像头，请检查设备连接。',
  NotReadableError: '摄像头正被其他应用占用，请关闭占用程序后重试。',
  OverconstrainedError: '当前摄像头不支持所需画面尺寸。',
  SecurityError: '摄像头只能通过 HTTPS 或 localhost 使用。',
}

interface AppProps {
  mode: ColorMode
  onToggleColorMode: () => void
}

function App({ mode, onToggleColorMode }: AppProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const isBlinkingRef = useRef(false)
  const blinkStartedAtRef = useRef<number | null>(null)
  const lastUiUpdateRef = useRef(0)
  const latestGazeFeatureRef = useRef<GazeFeature | null>(null)
  const smoothedGazeRef = useRef<GazePoint | null>(null)
  const lastGazeUiUpdateRef = useRef(0)
  const hadGazePredictionRef = useRef(false)

  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [readout, setReadout] = useState<EyeReadout>(EMPTY_EYE_READOUT)
  const [blinkCount, setBlinkCount] = useState(0)
  const [lastBlinkAt, setLastBlinkAt] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [method, setMethod] = useState<EyeMethod>('blendshape')
  const [threshold, setThreshold] = useState(0.5)
  const [showMesh, setShowMesh] = useState(true)
  const [showEyeDetails, setShowEyeDetails] = useState(true)
  const [gazeModel, setGazeModel] = useState<GazeModel | null>(null)
  const [gazePoint, setGazePoint] = useState<GazePoint | null>(null)
  const [calibrationOpen, setCalibrationOpen] = useState(false)
  const [showGazeCursor, setShowGazeCursor] = useState(false)
  const [clock, setClock] = useState(() => Date.now())

  const handleResults = (results: FaceLandmarkerResult) => {
    const now = performance.now()
    const nextReadout = getEyeReadout(results, method, threshold)
    const gazeFeature = extractGazeFeature(results)
    latestGazeFeatureRef.current =
      nextReadout.hasFace && !nextReadout.isClosed ? gazeFeature : null

    if (!nextReadout.hasFace) {
      isBlinkingRef.current = false
      blinkStartedAtRef.current = null
    } else if (nextReadout.isClosed) {
      if (!isBlinkingRef.current) {
        isBlinkingRef.current = true
        blinkStartedAtRef.current = now
      }
    } else if (isBlinkingRef.current) {
      const closedDuration = now - (blinkStartedAtRef.current ?? now)
      isBlinkingRef.current = false
      blinkStartedAtRef.current = null

      if (closedDuration >= 70 && closedDuration <= 1500) {
        const blinkTime = Date.now()
        setBlinkCount((count) => count + 1)
        setLastBlinkAt(blinkTime)
        setClock(blinkTime)
      }
    }

    if (!nextReadout.hasFace || now - lastUiUpdateRef.current >= 75) {
      lastUiUpdateRef.current = now
      setReadout(nextReadout)
    }

    const canEstimateGaze =
      Boolean(gazeFeature) &&
      Boolean(gazeModel) &&
      nextReadout.hasFace &&
      !nextReadout.isClosed

    if (canEstimateGaze && gazeFeature && gazeModel) {
      const rawGaze = predictGaze(gazeModel, gazeFeature)
      const previousGaze = smoothedGazeRef.current
      const nextGaze = previousGaze
        ? {
            x: previousGaze.x * 0.78 + rawGaze.x * 0.22,
            y: previousGaze.y * 0.78 + rawGaze.y * 0.22,
          }
        : rawGaze

      smoothedGazeRef.current = nextGaze
      hadGazePredictionRef.current = true

      if (now - lastGazeUiUpdateRef.current >= 75) {
        lastGazeUiUpdateRef.current = now
        setGazePoint(nextGaze)
      }
    } else if (hadGazePredictionRef.current) {
      hadGazePredictionRef.current = false
      smoothedGazeRef.current = null
      setGazePoint(null)
    }
  }

  const { modelStatus, modelError, fps } = useFaceMesh({
    videoRef,
    canvasRef,
    enabled: cameraStatus === 'active',
    showMesh,
    showEyeDetails,
    onResults: handleResults,
  })

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (cameraStatus !== 'active' || startedAt === null) return

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }

    updateElapsed()
    const timer = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(timer)
  }, [cameraStatus, startedAt])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const resetSession = () => {
    setBlinkCount(0)
    setLastBlinkAt(null)
    setElapsedSeconds(0)
    setStartedAt(cameraStatus === 'active' ? Date.now() : null)
    setReadout(EMPTY_EYE_READOUT)
    isBlinkingRef.current = false
    blinkStartedAtRef.current = null
    lastUiUpdateRef.current = 0
  }

  const startCalibration = () => {
    if (cameraStatus !== 'active' || modelStatus !== 'ready') return
    setGazePoint(null)
    setShowGazeCursor(false)
    smoothedGazeRef.current = null
    lastGazeUiUpdateRef.current = 0
    hadGazePredictionRef.current = false
    setCalibrationOpen(true)
  }

  const completeCalibration = (points: GazeCalibrationPoint[]) => {
    const model = fitGazeModel(points)

    if (!model) {
      return '有效样本不足。请保持正脸、双眼可见，并在每个圆点出现时稳定注视。'
    }

    setGazeModel(model)
    setGazePoint(null)
    setShowGazeCursor(true)
    smoothedGazeRef.current = null
    lastGazeUiUpdateRef.current = 0
    hadGazePredictionRef.current = false
    return null
  }

  const clearCalibration = () => {
    setGazeModel(null)
    setGazePoint(null)
    setShowGazeCursor(false)
    smoothedGazeRef.current = null
    lastGazeUiUpdateRef.current = 0
    hadGazePredictionRef.current = false
  }

  const startCamera = async () => {
    if (cameraStatus === 'requesting' || modelStatus !== 'ready') return

    setCameraStatus('requesting')
    setCameraError(null)

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('UNSUPPORTED')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
          aspectRatio: { ideal: 4 / 3 },
          frameRate: { ideal: 30, max: 30 },
        },
      })

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error('VIDEO_UNAVAILABLE')
      }

      streamRef.current = stream
      video.srcObject = stream
      await video.play()

      const [videoTrack] = stream.getVideoTracks()
      videoTrack?.addEventListener(
        'ended',
        () => {
          if (streamRef.current !== stream) return
          setCameraStatus('error')
          setCameraError('摄像头连接已断开，请重新开启。')
          setReadout(EMPTY_EYE_READOUT)
          latestGazeFeatureRef.current = null
        },
        { once: true },
      )

      setBlinkCount(0)
      setLastBlinkAt(null)
      setElapsedSeconds(0)
      setStartedAt(Date.now())
      setReadout(EMPTY_EYE_READOUT)
      latestGazeFeatureRef.current = null
      lastUiUpdateRef.current = 0
      setCameraStatus('active')
    } catch (error) {
      const cameraFailure =
        error instanceof DOMException
          ? CAMERA_ERRORS[error.name] ?? error.message
          : error instanceof Error && error.message === 'UNSUPPORTED'
            ? '当前浏览器不支持摄像头访问，请使用最新版 Chrome、Edge 或 Safari。'
            : error instanceof Error && error.message === 'VIDEO_UNAVAILABLE'
              ? '摄像头画面尚未准备好，请重试。'
              : '无法启动摄像头，请检查权限和设备状态。'

      setCameraStatus('error')
      setCameraError(cameraFailure)
      setReadout(EMPTY_EYE_READOUT)
    latestGazeFeatureRef.current = null
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    isBlinkingRef.current = false
    blinkStartedAtRef.current = null
    setCameraStatus('idle')
    setCameraError(null)
    setReadout(EMPTY_EYE_READOUT)
    latestGazeFeatureRef.current = null
    setGazePoint(null)
    hadGazePredictionRef.current = false
    smoothedGazeRef.current = null
    setStartedAt(null)
    setElapsedSeconds(0)
  }

  const changeMethod = (nextMethod: EyeMethod) => {
    setMethod(nextMethod)
    setThreshold(nextMethod === 'blendshape' ? 0.5 : 0.2)
    isBlinkingRef.current = false
    blinkStartedAtRef.current = null
  }

  const blinkRate =
    elapsedSeconds >= 5
      ? `${((blinkCount / elapsedSeconds) * 60).toFixed(1)} 次/分`
      : '采集数据中'

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container
        maxWidth="xl"
        sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: 5 }}
      >
        <AppHeader mode={mode} onToggleColorMode={onToggleColorMode} />

        <Box component="main">
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.4fr) 1fr' },
              alignItems: 'end',
              gap: { xs: 2, md: 6 },
              py: { xs: 4, sm: 5, lg: 7 },
            }}
          >
            <Typography component="h1" variant="h1">
              看清每一次
              <Box component="span" sx={{ color: 'success.main' }}>
                眨眼
              </Box>
              。
            </Typography>
            <Typography
              variant="body1"
              sx={{
                maxWidth: 520,
                color: 'text.secondary',
                pb: { md: 0.6 },
              }}
            >
              使用 MediaPipe FaceMesh 在浏览器中读取面部关键点，
              实时判断双眼开合。所有视频帧只停留在本机。
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'minmax(0, 1fr)',
                lg: 'minmax(0, 1.58fr) minmax(350px, 0.72fr)',
              },
              alignItems: 'start',
              gap: { xs: 2.5, sm: 3 },
            }}
          >
            <Stack spacing={{ xs: 2.5, sm: 3 }}>
              <CameraPanel
                videoRef={videoRef}
                canvasRef={canvasRef}
                cameraStatus={cameraStatus}
                modelStatus={modelStatus}
                modelError={modelError}
                cameraError={cameraError}
                hasFace={readout.hasFace}
                fps={fps}
                showMesh={showMesh}
                onToggleMesh={() => setShowMesh((value) => !value)}
                onStart={() => void startCamera()}
                onStop={stopCamera}
                onReset={resetSession}
              />
              <GazePanel
                cameraStatus={cameraStatus}
                modelReady={modelStatus === 'ready'}
                isCalibrated={Boolean(gazeModel)}
                gazePoint={gazePoint}
                showCursor={showGazeCursor}
                colorMode={mode}
                onStartCalibration={startCalibration}
                onClearCalibration={clearCalibration}
                onToggleCursor={setShowGazeCursor}
              />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(2, minmax(0, 1fr))',
                  lg: '1fr',
                },
                alignItems: 'start',
                gap: { xs: 2.5, sm: 3 },
              }}
            >
              <EyeSignals
                cameraStatus={cameraStatus}
                readout={readout}
                method={method}
                blinkCount={blinkCount}
                blinkRate={blinkRate}
                elapsedLabel={formatElapsed(elapsedSeconds)}
                lastBlinkLabel={formatLastBlink(lastBlinkAt)}
                modelReady={modelStatus === 'ready'}
                fps={fps}
              />
              <DetectionSettings
                method={method}
                threshold={threshold}
                showMesh={showMesh}
                showEyeDetails={showEyeDetails}
                canReset={cameraStatus === 'active'}
                onMethodChange={changeMethod}
                onThresholdChange={setThreshold}
                onShowMeshChange={setShowMesh}
                onShowEyeDetailsChange={setShowEyeDetails}
                onReset={resetSession}
              />
            </Box>
          </Box>

          <Divider sx={{ mt: { xs: 5, md: 7 }, mb: 2.5 }} />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'space-between' }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              FaceLandmarker · Blendshape & EAR
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {clock ? '本地推理 · 无图像上传' : '本地推理'}
            </Typography>
          </Stack>
        </Box>
      </Container>

      <GazeCalibrationDialog
        open={calibrationOpen}
        latestFeatureRef={latestGazeFeatureRef}
        onComplete={completeCalibration}
        onClose={() => setCalibrationOpen(false)}
      />

      {showGazeCursor &&
        gazePoint &&
        cameraStatus === 'active' &&
        !calibrationOpen && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'fixed',
              left: `${gazePoint.x * 100}%`,
              top: `${gazePoint.y * 100}%`,
              width: 16,
              height: 16,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              bgcolor: 'secondary.main',
              border: 2,
              borderColor: 'secondary.contrastText',
              boxShadow: 4,
              pointerEvents: 'none',
              zIndex: 'tooltip',
              transition: 'left 70ms linear, top 70ms linear',
            }}
          />
        )}
    </Box>
  )
}

export default App
