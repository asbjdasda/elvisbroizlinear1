import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  closeSync,
  readSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PRODUCT_VIDEO_SOURCES, SOURCE_ROOT } from './product-video-sources.mjs'

export const OUTPUT_ROOT = path.resolve('tmp-product-video-delivery')
export const VIDEO_GATEWAY_BASE = 'https://video.elvisbroizlinear.com'
export const R2_BUCKET = 'elvisbroizlinear'
export const REMOTE_PROBE_BYTES = 1024 * 1024

const FFMPEG_PATH = ffmpegInstaller.path
const MAX_SOURCE_BITRATE_KBPS = 6000
const MAX_DELIVERY_BITRATE_KBPS = 6500

function dimensionsExceedLimit({ width, height }) {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return true
  const portrait = height > width
  return portrait ? width > 1080 || height > 1920 : width > 1920 || height > 1080
}

export function needsTranscode(metadata) {
  return (
    metadata.videoCodec !== 'h264' ||
    (metadata.audioCodec !== null && metadata.audioCodec !== 'aac') ||
    metadata.bitrateKbps > MAX_SOURCE_BITRATE_KBPS ||
    dimensionsExceedLimit(metadata)
  )
}

export function topLevelAtomOrder(buffer) {
  const atoms = []
  let offset = 0

  while (offset + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    let headerSize = 8

    if (size === 1) {
      if (offset + 16 > buffer.length) break
      size = Number(buffer.readBigUInt64BE(offset + 8))
      headerSize = 16
    } else if (size === 0) {
      size = buffer.length - offset
    }

    if (size < headerSize) break
    atoms.push(type)
    if (offset + size > buffer.length) break
    offset += size
  }

  return atoms
}

export function buildTranscodeArgs(inputPath, outputPath, metadata) {
  const portrait = metadata.height > metadata.width
  const maxWidth = portrait ? 1080 : 1920
  const maxHeight = portrait ? 1920 : 1080
  const scale = [
    `scale=w=min(${maxWidth}\\,iw):h=min(${maxHeight}\\,ih):force_original_aspect_ratio=decrease`,
    'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  ].join(',')

  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-stats',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    scale,
    '-c:v',
    'libx264',
    '-crf',
    '21',
    '-maxrate',
    '5800k',
    '-bufsize',
    '12M',
    '-pix_fmt',
    'yuv420p',
    '-force_key_frames',
    'expr:gte(t,n_forced*2)',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}

export function buildRemuxArgs(inputPath, outputPath) {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-stats',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0',
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}

function runFfmpeg(args, options = {}) {
  const result = spawnSync(FFMPEG_PATH, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: options.capture ? 'pipe' : 'inherit',
  })
  if (result.error) throw result.error
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(`FFmpeg exited with status ${result.status}`)
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`
}

export function inspectMedia(filePath) {
  const output = runFfmpeg(['-hide_banner', '-i', filePath], {
    allowFailure: true,
    capture: true,
  })
  const videoLine = output.split(/\r?\n/).find((line) => line.includes('Video:')) || ''
  const audioLine = output.split(/\r?\n/).find((line) => line.includes('Audio:')) || ''
  const durationMatch = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?).*?bitrate:\s*(\d+)\s*kb\/s/i)
  const videoCodecMatch = videoLine.match(/Video:\s*([a-zA-Z0-9_]+)/)
  const audioCodecMatch = audioLine.match(/Audio:\s*([a-zA-Z0-9_]+)/)
  const dimensionsMatch = videoLine.match(/,\s*(\d{2,5})x(\d{2,5})(?:\s|,|\[)/)

  if (!videoCodecMatch || !dimensionsMatch) {
    throw new Error(`Could not inspect video stream: ${filePath}`)
  }

  let durationSeconds = null
  let bitrateKbps = null
  if (durationMatch) {
    durationSeconds =
      Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    bitrateKbps = Number(durationMatch[4])
  }
  if (!Number.isFinite(bitrateKbps) && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    bitrateKbps = Math.round((statSync(filePath).size * 8) / durationSeconds / 1000)
  }

  return {
    videoCodec: videoCodecMatch[1].toLowerCase(),
    audioCodec: audioCodecMatch ? audioCodecMatch[1].toLowerCase() : null,
    width: Number(dimensionsMatch[1]),
    height: Number(dimensionsMatch[2]),
    bitrateKbps,
    durationSeconds,
  }
}

function readTopLevelAtomOrder(filePath) {
  const fileSize = statSync(filePath).size
  const descriptor = openSync(filePath, 'r')
  const atoms = []
  let offset = 0

  try {
    while (offset + 8 <= fileSize) {
      const header = Buffer.alloc(16)
      const bytesRead = readSync(descriptor, header, 0, 16, offset)
      if (bytesRead < 8) break

      let size = header.readUInt32BE(0)
      const type = header.toString('ascii', 4, 8)
      let headerSize = 8
      if (size === 1) {
        if (bytesRead < 16) break
        size = Number(header.readBigUInt64BE(8))
        headerSize = 16
      } else if (size === 0) {
        size = fileSize - offset
      }
      if (!Number.isSafeInteger(size) || size < headerSize) break

      atoms.push(type)
      offset += size
    }
  } finally {
    closeSync(descriptor)
  }

  return atoms
}

export function validateDeliveryMetadata(metadata) {
  const errors = []
  if (metadata.videoCodec !== 'h264') errors.push(`video codec is ${metadata.videoCodec}, expected h264`)
  if (metadata.audioCodec !== null && metadata.audioCodec !== 'aac') {
    errors.push(`audio codec is ${metadata.audioCodec}, expected aac`)
  }
  if (!Number.isFinite(metadata.bitrateKbps) || metadata.bitrateKbps > MAX_DELIVERY_BITRATE_KBPS) {
    errors.push(`bitrate is ${metadata.bitrateKbps ?? 'unknown'} kbps, expected <= ${MAX_DELIVERY_BITRATE_KBPS}`)
  }
  if (dimensionsExceedLimit(metadata)) {
    errors.push(`dimensions are ${metadata.width}x${metadata.height}, expected at most 1080p`)
  }

  const moovIndex = metadata.atomOrder.indexOf('moov')
  const mdatIndex = metadata.atomOrder.indexOf('mdat')
  if (moovIndex === -1 || mdatIndex === -1 || moovIndex > mdatIndex) {
    errors.push(`atom order is ${metadata.atomOrder.join(',')}, expected moov before mdat`)
  }
  return errors
}

function outputPathForKey(key) {
  return path.join(OUTPUT_ROOT, ...key.replace(/^\//, '').split('/'))
}

function relativeOutputKey(filePath) {
  return `/${path.relative(OUTPUT_ROOT, filePath).split(path.sep).join('/')}`
}

function walkFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath]
  })
}

function resetOutputRoot() {
  const expected = path.resolve('tmp-product-video-delivery')
  if (OUTPUT_ROOT !== expected || path.basename(OUTPUT_ROOT) !== 'tmp-product-video-delivery') {
    throw new Error(`Refusing to reset unexpected output path: ${OUTPUT_ROOT}`)
  }
  rmSync(OUTPUT_ROOT, { recursive: true, force: true })
  mkdirSync(OUTPUT_ROOT, { recursive: true })
}

export function prepareAll() {
  resetOutputRoot()
  const entries = Object.entries(PRODUCT_VIDEO_SOURCES)
  let transcodes = 0
  let remuxes = 0

  entries.forEach(([key, relativeSource], index) => {
    const inputPath = path.join(SOURCE_ROOT, relativeSource)
    const outputPath = outputPathForKey(key)
    if (!existsSync(inputPath)) throw new Error(`Missing source for ${key}: ${inputPath}`)
    mkdirSync(path.dirname(outputPath), { recursive: true })

    const metadata = inspectMedia(inputPath)
    const transcode = needsTranscode(metadata)
    console.log(
      `[${index + 1}/${entries.length}] ${transcode ? 'transcode' : 'faststart remux'} ${key} ` +
        `(${metadata.videoCodec}/${metadata.audioCodec || 'silent'}, ${metadata.width}x${metadata.height}, ${metadata.bitrateKbps} kbps)`,
    )
    runFfmpeg(
      transcode
        ? buildTranscodeArgs(inputPath, outputPath, metadata)
        : buildRemuxArgs(inputPath, outputPath),
    )
    if (transcode) transcodes += 1
    else remuxes += 1
  })

  console.log(`Prepared ${entries.length} videos: ${transcodes} transcodes, ${remuxes} faststart remuxes.`)
  return { total: entries.length, transcodes, remuxes }
}

export function verifyAll() {
  const expectedKeys = Object.keys(PRODUCT_VIDEO_SOURCES).toSorted()
  const outputFiles = walkFiles(OUTPUT_ROOT)
  const actualKeys = outputFiles.map(relativeOutputKey).toSorted()
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    const missing = expectedKeys.filter((key) => !actualKeys.includes(key))
    const extra = actualKeys.filter((key) => !expectedKeys.includes(key))
    throw new Error(`Delivery key mismatch. Missing: ${missing.join(', ') || 'none'}. Extra: ${extra.join(', ') || 'none'}.`)
  }

  const verified = []
  for (const key of expectedKeys) {
    const filePath = outputPathForKey(key)
    const metadata = {
      ...inspectMedia(filePath),
      atomOrder: readTopLevelAtomOrder(filePath),
    }
    const errors = validateDeliveryMetadata(metadata)
    if (errors.length > 0) throw new Error(`${key}: ${errors.join('; ')}`)
    verified.push({ key, filePath, size: statSync(filePath).size, metadata })
    console.log(
      `[verified ${verified.length}/${expectedKeys.length}] ${key} ` +
        `(${metadata.width}x${metadata.height}, ${metadata.bitrateKbps} kbps, ${metadata.atomOrder.join('>')})`,
    )
  }
  console.log(`Verified ${verified.length} delivery videos.`)
  return verified
}

async function remoteHead(key) {
  const response = await runWithRetries(
    () => fetch(`${VIDEO_GATEWAY_BASE}${key}`, { method: 'HEAD' }),
    {
      onRetry: (error, attempt) => {
        console.warn(`${key}: HEAD attempt ${attempt} failed (${error.message}); retrying.`)
      },
    },
  )
  return {
    status: response.status,
    etag: response.headers.get('etag'),
    length: Number(response.headers.get('content-length')),
  }
}

export function isAllowedPreUploadStatus(status) {
  return status === 200 || status === 404
}

async function verifyRemoteRange(key) {
  const { response, bytes } = await runWithRetries(
    async () => {
      const rangeResponse = await fetch(`${VIDEO_GATEWAY_BASE}${key}`, {
        headers: { Range: `bytes=0-${REMOTE_PROBE_BYTES - 1}` },
      })
      return { response: rangeResponse, bytes: Buffer.from(await rangeResponse.arrayBuffer()) }
    },
    {
      onRetry: (error, attempt) => {
        console.warn(`${key}: range attempt ${attempt} failed (${error.message}); retrying.`)
      },
    },
  )
  const atomOrder = topLevelAtomOrder(bytes)
  const moovIndex = atomOrder.indexOf('moov')
  const mdatIndex = atomOrder.indexOf('mdat')
  if (response.status !== 206 || moovIndex === -1 || mdatIndex === -1 || moovIndex > mdatIndex) {
    throw new Error(`${key}: remote range failed faststart check (${response.status}, ${atomOrder.join('>')})`)
  }
  return response.headers.get('cf-cache-status')
}

export function resolveWranglerInvocation(wranglerPath, args) {
  if (process.platform === 'win32' && wranglerPath.toLowerCase().endsWith('.cmd')) {
    const wranglerScript = path.resolve(path.dirname(wranglerPath), '..', 'wrangler', 'bin', 'wrangler.js')
    return { command: process.execPath, args: [wranglerScript, ...args], wranglerScript }
  }
  return { command: wranglerPath, args }
}

function runWrangler(wranglerPath, args) {
  const invocation = resolveWranglerInvocation(wranglerPath, args)
  if (invocation.wranglerScript && !existsSync(invocation.wranglerScript)) {
    throw new Error(`Could not resolve Wrangler JavaScript entry point: ${invocation.wranglerScript}`)
  }
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Wrangler exited with status ${result.status}`)
}

export async function runWithRetries(
  operation,
  {
    maxAttempts = 3,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    onRetry = () => {},
  } = {},
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt)
    } catch (error) {
      if (attempt === maxAttempts) throw error
      onRetry(error, attempt)
      await wait(attempt * 2000)
    }
  }
  throw new Error('Retry loop ended unexpectedly')
}

export function selectUploadItems(verified, startAt = null) {
  if (!startAt) return verified
  const startIndex = verified.findIndex((item) => item.key === startAt)
  if (startIndex === -1) throw new Error(`Upload start key is not in the verified manifest: ${startAt}`)
  return verified.slice(startIndex)
}

export async function uploadAll(wranglerPath, startAt = null) {
  if (!wranglerPath) throw new Error('upload requires --wrangler <absolute-wrangler-path>')
  if (!path.isAbsolute(wranglerPath) || !existsSync(wranglerPath)) {
    throw new Error(`Wrangler path does not exist or is not absolute: ${wranglerPath}`)
  }

  const verified = verifyAll()
  const uploadItems = selectUploadItems(verified, startAt)
  for (const [index, item] of uploadItems.entries()) {
    const before = await remoteHead(item.key)
    if (!isAllowedPreUploadStatus(before.status)) {
      throw new Error(`${item.key}: pre-upload HEAD returned ${before.status}`)
    }
    console.log(`[upload ${index + 1}/${uploadItems.length}] ${item.key}`)
    await runWithRetries(
      () =>
        runWrangler(wranglerPath, [
          'r2',
          'object',
          'put',
          `${R2_BUCKET}${item.key}`,
          '--file',
          item.filePath,
          '--content-type',
          'video/mp4',
          '--remote',
        ]),
      {
        onRetry: (error, attempt) => {
          console.warn(`${item.key}: upload attempt ${attempt} failed (${error.message}); retrying.`)
        },
      },
    )

    const after = await remoteHead(item.key)
    if (after.status !== 200) throw new Error(`${item.key}: post-upload HEAD returned ${after.status}`)
    if (after.length !== item.size) {
      throw new Error(`${item.key}: remote size ${after.length} does not match local size ${item.size}`)
    }
    const firstCache = await verifyRemoteRange(item.key)
    const secondCache = await verifyRemoteRange(item.key)
    console.log(
      `[remote ${index + 1}/${uploadItems.length}] ${item.key} ` +
        `etag ${before.etag === after.etag ? 'unchanged (already current)' : 'changed'}, range 206, cache ${firstCache || 'n/a'} -> ${secondCache || 'n/a'}`,
    )
  }
  console.log(`Uploaded and remotely verified ${uploadItems.length} R2 videos.`)
}

function cliArgument(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : process.argv[index + 1]
}

async function main() {
  const command = process.argv[2]
  if (command === 'prepare') prepareAll()
  else if (command === 'verify') verifyAll()
  else if (command === 'upload') await uploadAll(cliArgument('--wrangler'), cliArgument('--start-at'))
  else throw new Error('Usage: node scripts/video-delivery.mjs <prepare|verify|upload> [--wrangler <path>]')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
