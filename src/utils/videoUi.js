export function trimComments(comments, limit = 20) {
  return Array.isArray(comments) ? comments.slice(0, limit) : []
}

export function buildVideoShareUrl(videoId, { origin = '', pathname = '/', search = '' } = {}) {
  const safeOrigin = origin || 'https://elvisbroizlinear.com'
  const safePathname = pathname || '/'
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (videoId) params.set('video', videoId)
  const query = params.toString()
  return `${safeOrigin}${safePathname}${query ? `?${query}` : ''}`
}

export function getBufferedPercent({ duration, bufferedRanges }) {
  if (!Number.isFinite(duration) || duration <= 0 || !Array.isArray(bufferedRanges) || !bufferedRanges.length) return 0

  const furthestEnd = bufferedRanges.reduce((max, range) => {
    const end = Number(range?.[1])
    return Number.isFinite(end) ? Math.max(max, end) : max
  }, 0)

  return Math.max(0, Math.min(100, Math.round((furthestEnd / duration) * 100)))
}

export function timePercent(currentTime, duration) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0
  return Math.max(0, Math.min(100, (currentTime / duration) * 100))
}

export function formatVideoTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60
  const pad = (value) => String(value).padStart(2, '0')

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(remainingSeconds)}`
  return `${pad(minutes)}:${pad(remainingSeconds)}`
}

export function pointerPercentFromRect({ clientX, left, width }) {
  const safeWidth = Number(width)
  if (!Number.isFinite(safeWidth) || safeWidth <= 0) return 0
  const rawPercent = ((Number(clientX) - Number(left)) / safeWidth) * 100
  if (!Number.isFinite(rawPercent)) return 0
  return Math.max(0, Math.min(100, rawPercent))
}

export function timeFromPercent(percent, duration) {
  if (!Number.isFinite(percent) || !Number.isFinite(duration) || duration <= 0) return 0
  return (Math.max(0, Math.min(100, percent)) / 100) * duration
}
