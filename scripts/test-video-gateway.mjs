import assert from 'node:assert/strict'
import worker from '../workers/video-gateway.js'

class MemoryCache {
  constructor() {
    this.entries = new Map()
  }

  async match(request) {
    return this.entries.get(request.url)?.clone()
  }

  async put(request, response) {
    this.entries.set(request.url, response.clone())
  }
}

const bytes = new TextEncoder().encode('0123456789')
let r2Reads = 0
let r2Etag = '"video-etag-v1"'
const env = {
  ALLOWED_ORIGINS: 'https://elvisbroizlinear.com,https://www.elvisbroizlinear.com',
  VIDEOS: {
    async head() {
      return { size: bytes.length, httpEtag: r2Etag }
    },
    async get(_key, options) {
      r2Reads += 1
      const offset = options?.range?.offset ?? 0
      const length = options?.range?.length ?? bytes.length
      const body = bytes.slice(offset, offset + length)
      return {
        body,
        httpEtag: r2Etag,
        writeHttpMetadata(headers) {
          headers.set('Content-Type', 'video/mp4')
        },
      }
    },
  },
}

globalThis.caches = { default: new MemoryCache() }

const context = {
  promises: [],
  waitUntil(promise) {
    this.promises.push(promise)
  },
}

const url = 'https://video.elvisbroizlinear.com/assets/product-videos/demo.mp4?exp=visitor-specific&sig=ignored'
const first = await worker.fetch(new Request(url, {
  headers: { Origin: 'https://www.elvisbroizlinear.com', Range: 'bytes=2-5' },
}), env, context)
await Promise.all(context.promises.splice(0))

assert.equal(first.status, 206)
assert.equal(first.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
assert.equal(first.headers.get('Cloudflare-CDN-Cache-Control'), 'public, max-age=31536000, immutable')
assert.equal(first.headers.get('CF-Cache-Status'), 'MISS')
assert.equal(first.headers.get('Content-Range'), 'bytes 2-5/10')
assert.equal(first.headers.get('Access-Control-Allow-Origin'), 'https://www.elvisbroizlinear.com')
assert.equal(await first.text(), '2345')

const secondContext = { promises: [], waitUntil(promise) { this.promises.push(promise) } }
const second = await worker.fetch(new Request(
  'https://video.elvisbroizlinear.com/assets/product-videos/demo.mp4?exp=another-visitor&sig=different',
  { headers: { Origin: 'https://www.elvisbroizlinear.com', Range: 'bytes=2-5' } },
), env, secondContext)

assert.equal(second.status, 206)
assert.equal(second.headers.get('CF-Cache-Status'), 'HIT')
assert.equal(await second.text(), '2345')
assert.equal(r2Reads, 1, 'the same object range should be read from R2 only once')

r2Etag = '"video-etag-v2"'
const replacementContext = { promises: [], waitUntil(promise) { this.promises.push(promise) } }
const replacement = await worker.fetch(new Request(url, {
  headers: { Origin: 'https://www.elvisbroizlinear.com', Range: 'bytes=2-5' },
}), env, replacementContext)
await Promise.all(replacementContext.promises.splice(0))

assert.equal(replacement.status, 206)
assert.equal(replacement.headers.get('CF-Cache-Status'), 'MISS')
assert.equal(r2Reads, 2, 'a replacement object ETag must bypass the old cached range')

const traversal = await worker.fetch(
  new Request('https://video.elvisbroizlinear.com/assets/product-videos/../secret.mp4'),
  env,
  secondContext,
)
assert.equal(traversal.status, 404)

console.log('video gateway uses stable object/range cache keys, long-lived headers, CORS, and private R2 reads correctly.')
