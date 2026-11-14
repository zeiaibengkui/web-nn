import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { EyeReadout } from '../types'

const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const
const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const calculateEar = (
  landmarks: NormalizedLandmark[],
  indices: readonly [number, number, number, number, number, number],
) => {
  const points = indices.map((index) => landmarks[index])
  const horizontal = distance(points[0], points[3])

  if (!horizontal) return 0

  return (
    (distance(points[1], points[5]) + distance(points[2], points[4])) /
    (2 * horizontal)
  )
}

const getBlendshapeScore = (
  result: FaceLandmarkerResult,
  name: 'eyeBlinkLeft' | 'eyeBlinkRight',
) =>
  result.faceBlendshapes[0]?.categories.find(
    (category) => category.categoryName === name,
  )?.score ?? 0

export const getEyeReadout = (
  result: FaceLandmarkerResult,
  method: 'blendshape' | 'ear',
  threshold: number,
): EyeReadout => {
  const landmarks = result.faceLandmarks[0]

  if (!landmarks) {
    return {
      hasFace: false,
      isClosed: false,
      leftBlink: 0,
      rightBlink: 0,
      leftEar: 0,
      rightEar: 0,
    }
  }

  const leftBlink = getBlendshapeScore(result, 'eyeBlinkLeft')
  const rightBlink = getBlendshapeScore(result, 'eyeBlinkRight')
  const leftEar = calculateEar(landmarks, LEFT_EYE)
  const rightEar = calculateEar(landmarks, RIGHT_EYE)
  const isClosed =
    method === 'blendshape'
      ? (leftBlink + rightBlink) / 2 > threshold
      : (leftEar + rightEar) / 2 < threshold

  return {
    hasFace: true,
    isClosed,
    leftBlink,
    rightBlink,
    leftEar,
    rightEar,
  }
}

export const getOpenness = (
  readout: EyeReadout,
  method: 'blendshape' | 'ear',
  eye: 'left' | 'right',
) => {
  if (method === 'blendshape') {
    const blink = eye === 'left' ? readout.leftBlink : readout.rightBlink
    return Math.round(Math.max(0, Math.min(1, 1 - blink)) * 100)
  }

  const ear = eye === 'left' ? readout.leftEar : readout.rightEar
  return Math.round(Math.max(0, Math.min(1, (ear - 0.08) / 0.25)) * 100)
}
