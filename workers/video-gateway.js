const VIDEO_PREFIX = 'assets/product-videos/'
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || 'https://elvisbroizlinear.com')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const origins = allowedOrigins(env)
  const allowOrigin = origins.includes(origin) ? origin : origins[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, ETag, CF-Cache-Status, Age',
    Vary: 'Origin',
  }
}

function normalizeKey(rawKey) {
  let decoded
  try {
    decoded = decodeURIComponent(String(rawKey || ''))
  } catch {
    return ''
  }
  const key = decoded.replace(/^\/+/, '')
  if (!key.startsWith(VIDEO_PREFIX) || key.includes('..') || key.includes('\\')) return ''
  return key
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || '')
  if (!match) return null
  let start = match[1] ? Number(match[1]) : 0
  let end = match[2] ? Number(match[2]) : size - 1
  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2])
    start = Math.max(size - suffixLength, 0)
    end = size - 1
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null
  return { offset: start, length: Math.min(end, size - 1) - start + 1 }
}

function cacheRequest(url, range, etag) {
  const cacheUrl = new URL(`/${normalizeKey(url.pathname)}`, url.origin)
  if (etag) cacheUrl.searchParams.set('__r2_etag', etag)
  if (range) cacheUrl.searchParams.set('__range', `${range.offset}-${range.offset + range.length - 1}`)
  return new Request(cacheUrl, { method: 'GET' })
}

function clientResponse(cachedResponse, request, env, cacheStatus) {
  const headers = new Headers(cachedResponse.headers)
  for (const [name, value] of Object.entries(corsHeaders(request, env))) headers.set(name, value)
  headers.set('CF-Cache-Status', cacheStatus)
  const status = Number(headers.get('X-Video-Status')) || 200
  headers.delete('X-Video-Status')
  return new Response(request.method === 'HEAD' ? null : cachedResponse.body, { status, headers })
}

async function handleVideo(request, env, ctx) {
  const url = new URL(request.url)
  const key = normalizeKey(url.pathname)
  if (!key) return new Response('Not found', { status: 404, headers: corsHeaders(request, env) })

  const head = await env.VIDEOS.head(key)
  if (!head) return new Response('Not found', { status: 404, headers: corsHeaders(request, env) })

  const rangeHeader = request.headers.get('Range')
  const range = rangeHeader ? parseRange(rangeHeader, head.size) : null
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { ...corsHeaders(request, env), 'Content-Range': `bytes */${head.size}` } })
  }

  const cacheKey = cacheRequest(url, range, head.httpEtag || head.etag || '')
  const cached = await caches.default.match(cacheKey)
  if (cached) return clientResponse(cached, request, env, 'HIT')

  const object = await env.VIDEOS.get(key, range ? { range } : undefined)
  if (!object) return new Response('Not found', { status: 404, headers: corsHeaders(request, env) })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('ETag', object.httpEtag)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', CACHE_CONTROL)
  headers.set('Cloudflare-CDN-Cache-Control', CACHE_CONTROL)
  headers.set('Content-Disposition', 'inline')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Video-Status', range ? '206' : '200')
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'video/mp4')
  if (range) {
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`)
    headers.set('Content-Length', String(range.length))
  } else {
    headers.set('Content-Length', String(head.size))
  }

  const cacheable = new Response(object.body, { status: 200, headers })
  const response = clientResponse(cacheable.clone(), request, env, 'MISS')
  if (request.method === 'GET') ctx.waitUntil(caches.default.put(cacheKey, cacheable))
  return response
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request, env) })
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: corsHeaders(request, env) })
    return handleVideo(request, env, ctx)
  },
}
