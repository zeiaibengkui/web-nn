const BUNDLED_MODEL_PATHS: Record<string, string> = {
  senko: 'l2d-models/models/Senko_Normals/senko.model3.json',
  senko_normals: 'l2d-models/models/Senko_Normals/senko.model3.json',
  haru: 'l2d-models/models/Haru/Haru.model3.json',
  hiyori: 'l2d-models/models/Hiyori/Hiyori.model3.json',
  mao: 'l2d-models/models/Mao/Mao.model3.json',
  mark: 'l2d-models/models/Mark/Mark.model3.json',
  natori: 'l2d-models/models/Natori/Natori.model3.json',
  ren: 'l2d-models/models/Ren/Ren.model3.json',
  rice: 'l2d-models/models/Rice/Rice.model3.json',
  wanko: 'l2d-models/models/Wanko/Wanko.model3.json',
  abeikelongbi_3:
    'l2d-models/models/abeikelongbi_3/abeikelongbi_3.model3.json',
}

export const BUNDLED_MODEL_NAMES = [
  'senko',
  'haru',
  'hiyori',
  'mao',
  'mark',
  'natori',
  'ren',
  'rice',
  'wanko',
  'abeikelongbi_3',
] as const

export const BUNDLED_MODEL_OPTIONS = [
  { name: 'senko', label: 'Senko' },
  { name: 'haru', label: 'Haru' },
  { name: 'hiyori', label: 'Hiyori' },
  { name: 'mao', label: 'Mao' },
  { name: 'mark', label: 'Mark' },
  { name: 'natori', label: 'Natori' },
  { name: 'ren', label: 'Ren' },
  { name: 'rice', label: 'Rice' },
  { name: 'wanko', label: 'Wanko' },
  { name: 'abeikelongbi_3', label: 'Abeikelongbi' },
] as const

export const DEFAULT_LIVE2D_MODEL_URL =
  `${import.meta.env.BASE_URL}${BUNDLED_MODEL_PATHS.senko}`

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
  (() => {
    const params = new URLSearchParams(window.location.search)
    const requestedUrl = params.get('model_url')
    if (requestedUrl) return resolveLive2DModelUrl(requestedUrl)

    const modelName = params.get('model_name')?.trim().toLowerCase()
    const bundledPath = modelName
      ? BUNDLED_MODEL_PATHS[modelName]
      : undefined

    return bundledPath
      ? `${import.meta.env.BASE_URL}${bundledPath}`
      : FALLBACK_MODEL_URL
  })()

export interface Live2DModelSelection {
  modelName: string
  modelUrl: string
  isCustom: boolean
}

export const getBundledLive2DModelUrl = (modelName: string) => {
  const bundledPath = BUNDLED_MODEL_PATHS[modelName.trim().toLowerCase()]
  return bundledPath
    ? `${import.meta.env.BASE_URL}${bundledPath}`
    : DEFAULT_LIVE2D_MODEL_URL
}

export const getInitialLive2DModelSelection = (): Live2DModelSelection => {
  const params = new URLSearchParams(window.location.search)
  const requestedUrl = params.get('model_url')

  if (requestedUrl) {
    return {
      modelName: 'custom',
      modelUrl: resolveLive2DModelUrl(requestedUrl),
      isCustom: true,
    }
  }

  const requestedName = params.get('model_name')?.trim().toLowerCase()
  const option = BUNDLED_MODEL_OPTIONS.find(
    (candidate) =>
      candidate.name === requestedName ||
      (requestedName === 'senko_normals' && candidate.name === 'senko'),
  )
  const modelName = option?.name ?? 'senko'

  return {
    modelName,
    modelUrl: getBundledLive2DModelUrl(modelName),
    isCustom: false,
  }
}
