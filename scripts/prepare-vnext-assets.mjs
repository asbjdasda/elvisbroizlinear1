import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'
import { mkdir, copyFile, readdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { productVideoCategories } from '../src/data/productVideos.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const publicRoot = join(root, 'public')
const distRoot = join(root, 'dist')
const ffmpegPath = ffmpegInstaller.path

const staticAssets = [
  '/assets/brozien-identity-mark.png',
  '/assets/hero-preview.mp4',
  '/assets/hero-window-poster.jpg',
  '/assets/logos/samassi.png',
  '/assets/logos/nimo.png',
  '/assets/logos/herdio-logo-new.png',
  '/assets/logos/usay.png',
  '/assets/logos/titan.png',
  '/assets/logos/good-design.png',
  '/assets/logos/muse.png',
  '/assets/logos/leagend.png',
  '/assets/logos/fda.png',
  '/assets/skills/3dsmax.png',
  '/assets/skills/ai.png',
  '/assets/skills/cinema4d.png',
  '/assets/skills/xd.png',
  '/assets/skills/figma.png',
  '/assets/skills/ps.png',
  '/assets/skills/xmind.png',
  '/assets/skills/ae.png',
  '/assets/skills/redshift.webp',
  '/assets/skills/octane.webp',
  '/assets/social/figma.png',
  '/assets/social/instagram.png',
  '/assets/social/behance.png',
  '/assets/social/zcool-ball-white.png',
  '/assets/profile/ip-avatar-brozien.jpg',
  '/assets/profile/brozien-b-mark.png',
  '/assets/project-icons/video_fill.png',
  '/assets/project-icons/3d.png',
  '/assets/project-icons/graphic.png',
  '/assets/ui/animated-comments.gif',
  '/assets/ui/close-circle.svg',
  '/assets/ui/comments-expand.svg',
  '/assets/ui/expand.svg',
  '/assets/ui/social-facebook.jpg',
  '/assets/ui/social-instagram.jpg',
  '/assets/ui/social-x.jpg',
  '/assets/ui/social-youtube.jpg',
]

function cleanAssetPath(assetPath) {
  return assetPath.replace(/^\//, '')
}

function sourcePath(assetPath) {
  return join(publicRoot, cleanAssetPath(assetPath))
}

function outputPath(assetPath) {
  return join(distRoot, cleanAssetPath(assetPath))
}

async function ensureParent(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

async function copyAsset(assetPath) {
  const from = sourcePath(assetPath)
  const to = outputPath(assetPath)
  if (!existsSync(from)) {
    throw new Error(`Missing asset: ${relative(root, from)}`)
  }
  await ensureParent(to)
  await copyFile(from, to)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

async function transcodeVideo({ from, to, seconds, width, crf, maxrate, fps }) {
  if (!existsSync(from)) {
    throw new Error(`Missing video source: ${relative(root, from)}`)
  }
  await ensureParent(to)
  await run(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    from,
    '-an',
    '-t',
    String(seconds),
    '-vf',
    `scale=w=min(${width}\\,iw):h=-2,fps=${fps}`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(crf),
    '-maxrate',
    maxrate,
    '-bufsize',
    maxrate.replace('k', '0k'),
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    to,
  ])
}

async function transcodePoster({ from, to, width }) {
  if (!existsSync(from)) {
    throw new Error(`Missing poster source: ${relative(root, from)}`)
  }
  await ensureParent(to)
  await run(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    from,
    '-vf',
    `scale=w=min(${width}\\,iw):h=-2`,
    '-frames:v',
    '1',
    '-q:v',
    '7',
    to,
  ])
}

async function directorySize(path) {
  let total = 0
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) await walk(fullPath)
      else if (entry.isFile()) total += (await stat(fullPath)).size
    }
  }
  await walk(path)
  return total
}

await rm(join(distRoot, 'assets', 'product-video-previews'), { recursive: true, force: true })
await rm(join(distRoot, 'assets', 'product-videos'), { recursive: true, force: true })
await rm(join(distRoot, 'assets', 'videos'), { recursive: true, force: true })

for (const asset of staticAssets) {
  await copyAsset(asset)
}

const items = productVideoCategories.flatMap((category) => category.items)
for (const item of items) {
  await transcodePoster({
    from: sourcePath(item.poster),
    to: outputPath(item.poster),
    width: 720,
  })

  // Poster-only gallery cards have no preview video to publish.
  if (!item.previewSrc) continue

  const previewAssetPath = item.src.replace('/assets/product-videos/', '/assets/product-video-previews/')
  const previewSource = existsSync(sourcePath(previewAssetPath)) ? sourcePath(previewAssetPath) : sourcePath(item.src)
  await transcodeVideo({
    from: previewSource,
    to: outputPath(previewAssetPath),
    seconds: 7,
    width: 480,
    fps: 15,
    crf: 36,
    maxrate: '150k',
  })
}

const totalBytes = await directorySize(distRoot)
const totalMb = totalBytes / 1024 / 1024
console.log(`production artifact size: ${totalMb.toFixed(2)} MiB`)

if (totalBytes > 20 * 1024 * 1024) {
  console.warn('production artifact is larger than 20 MiB; product source videos are expected to be served from R2')
}
