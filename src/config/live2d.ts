export const DEFAULT_LIVE2D_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json'

export const LIVE2D_MODEL_URL =
  import.meta.env.VITE_LIVE2D_MODEL_URL || DEFAULT_LIVE2D_MODEL_URL
