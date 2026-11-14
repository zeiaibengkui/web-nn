export const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export const formatLastBlink = (lastBlinkAt: number | null) => {
  if (!lastBlinkAt) return '等待第一次眨眼'

  const secondsAgo = Math.max(1, Math.round((Date.now() - lastBlinkAt) / 1000))

  if (secondsAgo < 60) return `${secondsAgo} 秒前`
  return `${Math.floor(secondsAgo / 60)} 分钟前`
}
