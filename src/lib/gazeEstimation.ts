import type {
  FaceLandmarkerResult,
  NormalizedLandmark,
} from '@mediapipe/tasks-vision'

const LEFT_IRIS = [468, 469, 470, 471, 472] as const
const RIGHT_IRIS = [473, 474, 475, 476, 477] as const

export interface GazeFeature {
  irisX: number
  irisY: number
  headX: number
  headY: number
}

export interface GazeCalibrationPoint {
  targetX: number
  targetY: number
  feature: GazeFeature
  sampleCount: number
}

export interface GazeModel {
  weightsX: number[]
  weightsY: number[]
}

export interface GazePoint {
  x: number
  y: number
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

const averageLandmarks = (
  landmarks: NormalizedLandmark[],
  indices: readonly number[],
) => {
  const points = indices.map((index) => landmarks[index])
  return points.reduce(
    (center, point) => ({
      x: center.x + point.x / points.length,
      y: center.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  )
}

const getEyeIrisPosition = (
  landmarks: NormalizedLandmark[],
  irisIndices: readonly number[],
  cornerA: number,
  cornerB: number,
  lidA: number,
  lidB: number,
) => {
  const iris = averageLandmarks(landmarks, irisIndices)
  const firstCorner = landmarks[cornerA]
  const secondCorner = landmarks[cornerB]
  const firstLid = landmarks[lidA]
  const secondLid = landmarks[lidB]
  const left = Math.min(firstCorner.x, secondCorner.x)
  const right = Math.max(firstCorner.x, secondCorner.x)
  const top = Math.min(firstLid.y, secondLid.y)
  const bottom = Math.max(firstLid.y, secondLid.y)
  const horizontalSpan = Math.max(0.001, right - left)
  const verticalSpan = Math.max(0.001, bottom - top)

  return {
    x: clamp((iris.x - left) / horizontalSpan),
    y: clamp((iris.y - top) / verticalSpan),
  }
}

export const extractGazeFeature = (
  result: FaceLandmarkerResult,
): GazeFeature | null => {
  const landmarks = result.faceLandmarks[0]
  if (!landmarks || landmarks.length < 478) return null

  const leftEye = getEyeIrisPosition(
    landmarks,
    LEFT_IRIS,
    33,
    133,
    159,
    145,
  )
  const rightEye = getEyeIrisPosition(
    landmarks,
    RIGHT_IRIS,
    362,
    263,
    386,
    374,
  )
  const nose = landmarks[1]
  const leftCorner = landmarks[33]
  const rightCorner = landmarks[263]
  const centerX = (leftCorner.x + rightCorner.x) / 2
  const centerY = (leftCorner.y + rightCorner.y) / 2
  const eyeSpan = Math.max(
    0.001,
    Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y),
  )

  return {
    irisX: (leftEye.x + rightEye.x) / 2,
    irisY: (leftEye.y + rightEye.y) / 2,
    headX: clamp((nose.x - centerX) / eyeSpan, -2, 2),
    headY: clamp((nose.y - centerY) / eyeSpan, -2, 2),
  }
}

const averageFeatures = (features: GazeFeature[]): GazeFeature => ({
  irisX:
    features.reduce((sum, feature) => sum + feature.irisX, 0) / features.length,
  irisY:
    features.reduce((sum, feature) => sum + feature.irisY, 0) / features.length,
  headX:
    features.reduce((sum, feature) => sum + feature.headX, 0) / features.length,
  headY:
    features.reduce((sum, feature) => sum + feature.headY, 0) / features.length,
})

export const aggregateCalibrationSamples = (
  targetX: number,
  targetY: number,
  features: GazeFeature[],
): GazeCalibrationPoint | null => {
  if (features.length < 5) return null

  return {
    targetX,
    targetY,
    feature: averageFeatures(features),
    sampleCount: features.length,
  }
}

const toDesignVector = (feature: GazeFeature) => [
  1,
  feature.irisX,
  feature.irisY,
  feature.headX,
  feature.headY,
  feature.irisX * feature.irisX,
  feature.irisY * feature.irisY,
]

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const size = vector.length
  const augmented = matrix.map((row, rowIndex) => [
    ...row,
    vector[rowIndex],
  ])

  for (let column = 0; column < size; column += 1) {
    let pivotRow = column

    for (let row = column + 1; row < size; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row
      }
    }

    if (Math.abs(augmented[pivotRow][column]) < 1e-10) return null

    ;[augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ]

    const pivot = augmented[column][column]
    for (let index = column; index <= size; index += 1) {
      augmented[column][index] /= pivot
    }

    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]

      for (let index = column; index <= size; index += 1) {
        augmented[row][index] -= factor * augmented[column][index]
      }
    }
  }

  return augmented.map((row) => row[size])
}

const fitRidgeRegression = (
  rows: number[][],
  targets: number[],
): number[] | null => {
  const featureCount = rows[0].length
  const normal = Array.from({ length: featureCount }, () =>
    Array<number>(featureCount).fill(0),
  )
  const projectedTargets = Array<number>(featureCount).fill(0)
  const regularization = 0.04

  rows.forEach((row, rowIndex) => {
    row.forEach((valueA, columnA) => {
      projectedTargets[columnA] += valueA * targets[rowIndex]
      row.forEach((valueB, columnB) => {
        normal[columnA][columnB] += valueA * valueB
      })
    })
  })

  for (let index = 1; index < featureCount; index += 1) {
    normal[index][index] += regularization
  }

  return solveLinearSystem(normal, projectedTargets)
}

export const fitGazeModel = (
  calibrationPoints: GazeCalibrationPoint[],
): GazeModel | null => {
  const validPoints = calibrationPoints.filter(
    (point) => point.sampleCount >= 5,
  )

  if (validPoints.length < 7) return null

  const rows = validPoints.map((point) => toDesignVector(point.feature))
  const weightsX = fitRidgeRegression(
    rows,
    validPoints.map((point) => point.targetX),
  )
  const weightsY = fitRidgeRegression(
    rows,
    validPoints.map((point) => point.targetY),
  )

  if (!weightsX || !weightsY) return null

  return { weightsX, weightsY }
}

const project = (weights: number[], feature: GazeFeature) => {
  const vector = toDesignVector(feature)
  return weights.reduce(
    (value, weight, index) => value + weight * vector[index],
    0,
  )
}

export const predictGaze = (
  model: GazeModel,
  feature: GazeFeature,
): GazePoint => ({
  x: clamp(project(model.weightsX, feature)),
  y: clamp(project(model.weightsY, feature)),
})
