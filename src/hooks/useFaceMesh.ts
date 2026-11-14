import { useEffect, useRef, useState } from 'react'
import {
  DrawingUtils,
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { ModelStatus } from '../types'

const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

interface UseFaceMeshOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  enabled: boolean
  showMesh: boolean
  showEyeDetails: boolean
  onResults: (result: FaceLandmarkerResult) => void
}

interface UseFaceMeshResult {
  modelStatus: ModelStatus
  modelError: string | null
  fps: number
}

const createLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  const options = {
    baseOptions: {
      modelAssetPath: MODEL_PATH,
      delegate: 'GPU' as const,
    },
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
    minFaceDetectionConfidence: 0.6,
    minFacePresenceConfidence: 0.6,
    minTrackingConfidence: 0.55,
  }

  try {
    return await FaceLandmarker.createFromOptions(vision, options)
  } catch {
    return FaceLandmarker.createFromOptions(vision, {
      ...options,
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate: 'CPU',
      },
    })
  }
}

export const useFaceMesh = ({
  videoRef,
  canvasRef,
  enabled,
  showMesh,
  showEyeDetails,
  onResults,
}: UseFaceMeshOptions): UseFaceMeshResult => {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('loading')
  const [modelError, setModelError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const onResultsRef = useRef(onResults)
  const displayOptionsRef = useRef({ showMesh, showEyeDetails })

  useEffect(() => {
    onResultsRef.current = onResults
  }, [onResults])

  useEffect(() => {
    displayOptionsRef.current = { showMesh, showEyeDetails }
  }, [showEyeDetails, showMesh])

  useEffect(() => {
    let cancelled = false

    const initialize = async () => {
      try {
        const landmarker = await createLandmarker()

        if (cancelled) {
          landmarker.close()
          return
        }

        landmarkerRef.current = landmarker
        setModelStatus('ready')
      } catch (error) {
        if (cancelled) return

        setModelStatus('error')
        setModelError(
          error instanceof Error ? error.message : 'FaceMesh 模型加载失败。',
        )
      }
    }

    void initialize()

    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || modelStatus !== 'ready') return

    const video = videoRef.current
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current

    if (!video || !canvas || !landmarker) return

    const context = canvas.getContext('2d')
    if (!context) return

    let animationFrameId = 0
    let running = true
    let lastVideoTime = -1
    let frameCount = 0
    let fpsWindowStartedAt = performance.now()
    let drawingUtils = new DrawingUtils(context)
    let drawingContext = context

    const renderLoop = () => {
      if (!running) return

      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        const nextCanvasContext = canvas.getContext('2d')

        if (nextCanvasContext && nextCanvasContext !== drawingContext) {
          drawingContext = nextCanvasContext
          drawingUtils = new DrawingUtils(nextCanvasContext)
        }

        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        } else if (canvas.height !== video.videoHeight) {
          canvas.height = video.videoHeight
        }

        lastVideoTime = video.currentTime
        const results = landmarker.detectForVideo(video, performance.now())
        const { showMesh: drawMesh, showEyeDetails: drawEyes } =
          displayOptionsRef.current

        context.clearRect(0, 0, canvas.width, canvas.height)

        for (const landmarks of results.faceLandmarks) {
          if (drawMesh) {
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_TESSELATION,
              {
                color: 'rgba(213, 255, 145, 0.22)',
                lineWidth: 1,
              },
            )
          }

          if (drawEyes) {
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
              { color: '#c8f169', lineWidth: 2 },
            )
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
              { color: '#c8f169', lineWidth: 2 },
            )
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
              { color: '#ffffff', lineWidth: 1.5 },
            )
            drawingUtils.drawConnectors(
              landmarks,
              FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
              { color: '#ffffff', lineWidth: 1.5 },
            )
          }
        }

        onResultsRef.current(results)
        frameCount += 1

        const now = performance.now()
        if (now - fpsWindowStartedAt >= 700) {
          setFps(
            Math.round(
              (frameCount * 1000) / Math.max(1, now - fpsWindowStartedAt),
            ),
          )
          frameCount = 0
          fpsWindowStartedAt = now
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop)
    }

    animationFrameId = requestAnimationFrame(renderLoop)

    return () => {
      running = false
      cancelAnimationFrame(animationFrameId)
      context.clearRect(0, 0, canvas.width, canvas.height)
      setFps(0)
    }
  }, [canvasRef, enabled, modelStatus, videoRef])

  return { modelStatus, modelError, fps }
}
