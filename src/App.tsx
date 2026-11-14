import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Container, Divider, Stack, Typography } from '@mui/material'
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { Face } from 'kalidokit'
import { AppHeader } from './components/AppHeader'
import { CameraPanel } from './components/CameraPanel'
import { DetectionSettings } from './components/DetectionSettings'
import { EyeSignals } from './components/EyeSignals'
import { Live2DPanel } from './components/Live2DPanel'
import {
  getBundledLive2DModelUrl,
  getInitialLive2DModelSelection,
  type Live2DModelSelection,
} from './config/live2d'
import { useFaceMesh } from './hooks/useFaceMesh'
import { getEyeReadout } from './lib/eyeMetrics'
import { formatElapsed, formatLastBlink } from './lib/format'
import {
  mapFaceToLive2D,
  type Live2DDrivers,
} from './lib/live2dMapping'
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
  isEmbedMode: boolean
  isDesktopMode: boolean
  mode: ColorMode
  onToggleColorMode: () => void
}

function App({
  isEmbedMode,
  isDesktopMode,
  mode,
  onToggleColorMode,
}: AppProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const isBlinkingRef = useRef(false)
  const blinkStartedAtRef = useRef<number | null>(null)
  const lastUiUpdateRef = useRef(0)
  const live2dDriversRef = useRef<Live2DDrivers | null>(null)

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
  const [live2dModel, setLive2DModel] =
    useState<Live2DModelSelection>(getInitialLive2DModelSelection)
  const [clock, setClock] = useState(() => Date.now())

  const handleResults = (results: FaceLandmarkerResult) => {
    const now = performance.now()
    const nextReadout = getEyeReadout(results, method, threshold)
    const landmarks = results.faceLandmarks[0]

    if (!landmarks) {
      live2dDriversRef.current = null
    } else {
      try {
        const solverInput = landmarks.map(({ x, y, z }) => ({ x, y, z }))
        const riggedFace = Face.solve(solverInput, {
          runtime: 'mediapipe',
          video: videoRef.current,
          smoothBlink: true,
          blinkSettings: [0.35, 0.5],
        })
        live2dDriversRef.current = riggedFace
          ? mapFaceToLive2D(riggedFace)
          : null
      } catch {
        live2dDriversRef.current = null
      }
    }

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

  const startCamera = useCallback(async () => {
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
          live2dDriversRef.current = null
        },
        { once: true },
      )

      setBlinkCount(0)
      setLastBlinkAt(null)
      setElapsedSeconds(0)
      setStartedAt(Date.now())
      setReadout(EMPTY_EYE_READOUT)
      live2dDriversRef.current = null
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
      live2dDriversRef.current = null
    }
  }, [cameraStatus, modelStatus])

  useEffect(() => {
    if (
      !isEmbedMode ||
      modelStatus !== 'ready' ||
      cameraStatus !== 'idle'
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void startCamera()
    }, 200)

    return () => window.clearTimeout(timer)
  }, [cameraStatus, isEmbedMode, modelStatus, startCamera])

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
    live2dDriversRef.current = null
    setStartedAt(null)
    setElapsedSeconds(0)
  }

  const changeMethod = (nextMethod: EyeMethod) => {
    setMethod(nextMethod)
    setThreshold(nextMethod === 'blendshape' ? 0.5 : 0.2)
    isBlinkingRef.current = false
    blinkStartedAtRef.current = null
  }

  const changeLive2DModel = (modelName: string) => {
    setLive2DModel({
      modelName,
      modelUrl: getBundledLive2DModelUrl(modelName),
      isCustom: false,
    })

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('model_name', modelName)
    nextUrl.searchParams.delete('model_url')
    window.history.replaceState(window.history.state, '', nextUrl)
  }

  const blinkRate =
    elapsedSeconds >= 5
      ? `${((blinkCount / elapsedSeconds) * 60).toFixed(1)} 次/分`
      : '采集数据中'

  if (isEmbedMode) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          bgcolor: 'transparent',
          ...(isDesktopMode
            ? {
                WebkitAppRegion: 'drag',
                cursor: 'grab',
                userSelect: 'none',
              }
            : {}),
        }}
        onPointerDown={() => {
          if (cameraStatus === 'error') void startCamera()
        }}
      >
        <Box
          component="video"
          ref={videoRef}
          muted
          playsInline
          autoPlay
          aria-hidden="true"
          sx={{
            position: 'fixed',
            left: -2,
            top: -2,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
        <Box
          component="canvas"
          ref={canvasRef}
          aria-hidden="true"
          sx={{ display: 'none' }}
        />
        <Live2DPanel
          embedded
          modelUrl={live2dModel.modelUrl}
          cameraStatus={cameraStatus}
          modelReady={modelStatus === 'ready'}
          faceDetected={readout.hasFace}
          driversRef={live2dDriversRef}
        />
      </Box>
    )
  }

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
              <Live2DPanel
                modelUrl={live2dModel.modelUrl}
                selectedModel={live2dModel.modelName}
                isCustomModel={live2dModel.isCustom}
                cameraStatus={cameraStatus}
                modelReady={modelStatus === 'ready'}
                faceDetected={readout.hasFace}
                driversRef={live2dDriversRef}
                onModelChange={changeLive2DModel}
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
    </Box>
  )
}

export default App
