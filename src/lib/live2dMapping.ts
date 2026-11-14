import type { TFace } from 'kalidokit'

export interface Live2DDrivers {
  angleX: number
  angleY: number
  angleZ: number
  bodyAngleX: number
  bodyAngleY: number
  bodyAngleZ: number
  eyeLeft: number
  eyeRight: number
  pupilX: number
  pupilY: number
  mouthOpen: number
  mouthForm: number
  brow: number
}

export const NEUTRAL_DRIVERS: Live2DDrivers = {
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  bodyAngleX: 0,
  bodyAngleY: 0,
  bodyAngleZ: 0,
  eyeLeft: 1,
  eyeRight: 1,
  pupilX: 0,
  pupilY: 0,
  mouthOpen: 0,
  mouthForm: 0,
  brow: 0,
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const mapFaceToLive2D = (face: TFace): Live2DDrivers => {
  const angleX = clamp(face.head.degrees.y * 0.85, -30, 30)
  const angleY = clamp(face.head.degrees.x * 0.85, -30, 30)
  const angleZ = clamp(face.head.degrees.z * 0.8, -30, 30)

  return {
    angleX,
    angleY,
    angleZ,
    bodyAngleX: angleX * 0.3,
    bodyAngleY: angleY * 0.22,
    bodyAngleZ: angleZ * 0.2,
    eyeLeft: clamp(face.eye.l, 0, 1),
    eyeRight: clamp(face.eye.r, 0, 1),
    pupilX: clamp(face.pupil.x, -1, 1),
    pupilY: clamp(face.pupil.y, -1, 1),
    mouthOpen: clamp(face.mouth.y, 0, 1),
    mouthForm: clamp(0.3 + face.mouth.x, -1, 1),
    brow: clamp(face.brow, -1, 1),
  }
}
