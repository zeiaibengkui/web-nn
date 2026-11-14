export type ModelStatus = 'loading' | 'ready' | 'error'
export type CameraStatus = 'idle' | 'requesting' | 'active' | 'error'
export type EyeMethod = 'blendshape' | 'ear'
export type ColorMode = 'light' | 'dark'

export interface EyeReadout {
  hasFace: boolean
  isClosed: boolean
  leftBlink: number
  rightBlink: number
  leftEar: number
  rightEar: number
}

export const EMPTY_EYE_READOUT: EyeReadout = {
  hasFace: false,
  isClosed: false,
  leftBlink: 0,
  rightBlink: 0,
  leftEar: 0,
  rightEar: 0,
}
