const LOCAL_SENKO_MODEL =
  'l2d-models/models/Senko_Normals/senko.model3.json'

export const DEFAULT_LIVE2D_MODEL_URL =
  `${import.meta.env.BASE_URL}${LOCAL_SENKO_MODEL}`

export const LIVE2D_MODEL_URL =
  import.meta.env.VITE_LIVE2D_MODEL_URL || DEFAULT_LIVE2D_MODEL_URL
