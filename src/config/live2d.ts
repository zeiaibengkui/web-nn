const LOCAL_SENKO_MODEL =
  'l2d-models/models/Senko_Normals/senko.model3.json'

export const DEFAULT_LIVE2D_MODEL_URL =
  `${import.meta.env.BASE_URL}${LOCAL_SENKO_MODEL}`

const FALLBACK_MODEL_URL =
  import.meta.env.VITE_LIVE2D_MODEL_URL || DEFAULT_LIVE2D_MODEL_URL

const isAbsoluteUrl = (value: string) =>
  /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')

export const resolveLive2DModelUrl = (requestedUrl: string | null) => {
  const requested = requestedUrl?.trim()
  if (!requested) return FALLBACK_MODEL_URL

  try {
    const parsedUrl = new URL(requested, window.location.href)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return FALLBACK_MODEL_URL
    }

    if (isAbsoluteUrl(requested)) return parsedUrl.href

    return `${import.meta.env.BASE_URL}${requested.replace(/^\/+/, '')}`
  } catch {
    return FALLBACK_MODEL_URL
  }
}

export const getLive2DModelUrl = () =>
  resolveLive2DModelUrl(
    new URLSearchParams(window.location.search).get('model_url'),
  )
