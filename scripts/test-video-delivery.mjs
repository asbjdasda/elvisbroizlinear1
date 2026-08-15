import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { productVideoCategories } from '../src/data/productVideos.js'
import { PRODUCT_VIDEO_SOURCES, SOURCE_ROOT } from './product-video-sources.mjs'
import {
  buildRemuxArgs,
  buildTranscodeArgs,
  isAllowedPreUploadStatus,
  needsTranscode,
  REMOTE_PROBE_BYTES,
  resolveWranglerInvocation,
  runWithRetries,
  selectUploadItems,
  topLevelAtomOrder,
  validateDeliveryMetadata,
} from './video-delivery.mjs'

assert.equal(REMOTE_PROBE_BYTES, 1024 * 1024, 'remote faststart probe must cover a large moov atom')
assert.equal(isAllowedPreUploadStatus(200), true, 'existing objects may be replaced')
assert.equal(isAllowedPreUploadStatus(404), true, 'new manifest objects may be created')
assert.equal(isAllowedPreUploadStatus(500), false, 'unexpected remote errors must block upload')
const wranglerInvocation = resolveWranglerInvocation(
  'C:\\cache path\\node_modules\\.bin\\wrangler.cmd',
  ['--file', 'E:\\repo path\\delivery.mp4'],
)
assert.equal(wranglerInvocation.command, process.execPath, 'npm Wrangler shim must run through Node')
assert.equal(
  wranglerInvocation.args.at(-1),
  'E:\\repo path\\delivery.mp4',
  'Wrangler file path with spaces must remain one process argument',
)
const uploadSelection = selectUploadItems(
  [{ key: '/one' }, { key: '/two' }, { key: '/three' }],
  '/two',
)
assert.deepEqual(uploadSelection.map((item) => item.key), ['/two', '/three'])
assert.throws(
  () => selectUploadItems([{ key: '/one' }], '/missing'),
  /start key is not in the verified manifest/,
)
let retryAttempts = 0
const retryResult = await runWithRetries(
  async () => {
    retryAttempts += 1
    if (retryAttempts < 3) throw new Error('transient')
    return 'uploaded'
  },
  { maxAttempts: 3, wait: async () => {} },
)
assert.equal(retryResult, 'uploaded')
assert.equal(retryAttempts, 3, 'transient upload failures must retry up to the configured attempt')
await assert.rejects(
  runWithRetries(async () => {
    throw new Error('persistent')
  }, { maxAttempts: 3, wait: async () => {} }),
  /persistent/,
)

const publishedVideos = productVideoCategories.flatMap((category) => category.items)
const publishedKeys = publishedVideos.map((video) => video.src)
const mappedKeys = Object.keys(PRODUCT_VIDEO_SOURCES)

assert.equal(publishedKeys.length, 36, 'expected exactly 36 published videos')
assert.equal(new Set(publishedKeys).size, 36, 'published video keys must be unique')
assert.deepEqual(
  mappedKeys.toSorted(),
  publishedKeys.toSorted(),
  'source manifest must map every published key exactly once and include no extras',
)

for (const [key, source] of Object.entries(PRODUCT_VIDEO_SOURCES)) {
  assert.ok(path.isAbsolute(SOURCE_ROOT), 'source root must be absolute')
  assert.equal(typeof source, 'string', `${key} must map to a relative source path`)
  assert.equal(path.isAbsolute(source), false, `${key} source must stay relative to SOURCE_ROOT`)
  assert.ok(existsSync(path.join(SOURCE_ROOT, source)), `${key} source file must exist`)
}

assert.equal(
  PRODUCT_VIDEO_SOURCES['/assets/product-videos/motion-graphics/01-animation-showreel.mp4'],
  path.join('Motion Graphics', 'The art of creative editing.mp4'),
  'stable showreel key must keep its explicitly replaced source',
)
assert.equal(
  PRODUCT_VIDEO_SOURCES['/assets/product-videos/3d-motion/07-halloween-big-mouth-monster-lego.mp4'],
  path.join('3D motion', 'Halloween Big Mouth Monster LEGO.mp4'),
  'Halloween video must use a stable key in 3D Motion',
)
assert.equal(
  productVideoCategories.find((category) => category.id === '3d-motion').items.at(-1).id,
  '07-halloween-big-mouth-monster-lego',
  'Halloween video must be the seventh 3D Motion item',
)

assert.equal(
  needsTranscode({
    bitrateKbps: 6001,
    videoCodec: 'h264',
    audioCodec: 'aac',
    width: 1920,
    height: 1080,
  }),
  true,
)
assert.equal(
  needsTranscode({
    bitrateKbps: 900,
    videoCodec: 'h264',
    audioCodec: 'aac',
    width: 1920,
    height: 1080,
  }),
  false,
)
assert.equal(
  needsTranscode({
    bitrateKbps: 5700,
    videoCodec: 'hevc',
    audioCodec: 'aac',
    width: 1920,
    height: 1080,
  }),
  true,
)

function atom(type, payloadBytes = 0) {
  const buffer = Buffer.alloc(8 + payloadBytes)
  buffer.writeUInt32BE(buffer.length, 0)
  buffer.write(type, 4, 4, 'ascii')
  return buffer
}

const fastStartFixture = Buffer.concat([atom('ftyp', 8), atom('moov', 12), atom('mdat', 16)])
const tailMoovFixture = Buffer.concat([atom('ftyp', 8), atom('mdat', 16), atom('moov', 12)])
assert.deepEqual(topLevelAtomOrder(fastStartFixture), ['ftyp', 'moov', 'mdat'])
assert.deepEqual(topLevelAtomOrder(tailMoovFixture), ['ftyp', 'mdat', 'moov'])

const landscapeArgs = buildTranscodeArgs('input.mp4', 'output.mp4', {
  width: 3840,
  height: 2160,
})
const portraitArgs = buildTranscodeArgs('input.mp4', 'output.mp4', {
  width: 2160,
  height: 3840,
})
const transcodeArgs = landscapeArgs.join(' ')

for (const required of [
  '-c:v libx264',
  '-crf 21',
  '-maxrate 5800k',
  '-bufsize 12M',
  '-pix_fmt yuv420p',
  '-c:a aac',
  '-b:a 160k',
  '-force_key_frames expr:gte(t,n_forced*2)',
  '-movflags +faststart',
]) {
  assert.ok(transcodeArgs.includes(required), `transcode args must include ${required}`)
}
assert.equal(
  transcodeArgs.includes('-maxrate 6M'),
  false,
  'video maxrate must leave room for AAC and MP4 overhead under the 6.5 Mbps total gate',
)
assert.ok(landscapeArgs.join(' ').includes('1920'), 'landscape output must cap width at 1920')
assert.ok(landscapeArgs.join(' ').includes('1080'), 'landscape output must cap height at 1080')
assert.ok(portraitArgs.join(' ').includes('1080'), 'portrait output must cap width at 1080')
assert.ok(portraitArgs.join(' ').includes('1920'), 'portrait output must cap height at 1920')

const remuxArgs = buildRemuxArgs('input.mp4', 'output.mp4').join(' ')
assert.ok(remuxArgs.includes('-c copy'), 'remux args must copy streams without quality loss')
assert.ok(remuxArgs.includes('-movflags +faststart'), 'remux args must move moov before mdat')

assert.deepEqual(
  validateDeliveryMetadata({
    bitrateKbps: 6400,
    videoCodec: 'h264',
    audioCodec: 'aac',
    width: 1920,
    height: 1080,
    atomOrder: ['ftyp', 'moov', 'mdat'],
  }),
  [],
)
assert.ok(
  validateDeliveryMetadata({
    bitrateKbps: 6501,
    videoCodec: 'hevc',
    audioCodec: 'mp3',
    width: 3840,
    height: 2160,
    atomOrder: ['ftyp', 'mdat', 'moov'],
  }).length >= 5,
  'delivery validation must reject bitrate, codecs, dimensions, and tail moov together',
)

console.log('Video delivery tests passed (36 published keys and delivery policy).')
