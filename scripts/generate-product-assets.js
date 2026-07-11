import ffmpeg from '@ffmpeg-installer/ffmpeg'
import { Buffer } from 'node:buffer'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const sourceRoot = 'E:\\Tatol_files_personal\\Brozien个人站_assets\\videos'
const publicRoot = path.resolve('public/assets/product-videos')
const dataPath = path.resolve('src/data/productVideos.js')

const categoryOrder = [
  ['3d-motion', '3D Motion', '3D motion'],
  ['filming-post', 'Filming & Post-Production', 'Filming & Post-Production'],
  ['ai-video-synthesis', 'AI Video Synthesis', 'AI Video Synthesis'],
  ['motion-graphics', 'Motion Graphics', 'Motion Graphics'],
  ['tvc-advertising', 'TVC', 'TVC'],
]

const videoExtensions = new Set(['.mp4', '.mov', '.m4v', '.webm', '.flv'])
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(fullPath) : [fullPath]
  })
}

function slugify(value) {
  const ascii = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return ascii || Buffer.from(value).toString('hex').slice(0, 16)
}

function titleFromFile(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nearestPosterInSameFolder(videoPath) {
  const sameDirImages = readdirSync(path.dirname(videoPath), { withFileTypes: true })
    .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(path.dirname(videoPath), entry.name))

  return sameDirImages[0] || null
}

function inspectVideo(videoPath) {
  const result = spawnSync(ffmpeg.path, ['-hide_banner', '-i', videoPath], { encoding: 'utf8' })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const match = output.match(/Video:\s.*?,\s(\d{2,5})x(\d{2,5})[\s,]/)
  const durationMatch = output.match(/Duration:\s(\d{2}):(\d{2}):(\d{2}\.\d{2})/)
  const width = match ? Number(match[1]) : null
  const height = match ? Number(match[2]) : null
  const duration = durationMatch
    ? Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])
    : null

  return {
    width,
    height,
    duration,
    orientation: width && height && height > width ? 'portrait' : 'landscape',
  }
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Demo'
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function runFfmpeg(args) {
  execFileSync(ffmpeg.path, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
}

function ensureWebVideo(videoPath, outputPath) {
  if (existsSync(outputPath)) return

  if (path.extname(videoPath).toLowerCase() === '.mp4') {
    cpSync(videoPath, outputPath)
    return
  }

  runFfmpeg(['-i', videoPath, '-map', '0:v:0?', '-map', '0:a?', '-c', 'copy', '-movflags', '+faststart', outputPath])
}

function ensurePoster(videoPath, sourcePoster, outputPath) {
  if (existsSync(outputPath)) return
  if (sourcePoster) {
    cpSync(sourcePoster, outputPath)
    return
  }

  runFfmpeg(['-ss', '00:00:01', '-i', videoPath, '-frames:v', '1', '-q:v', '3', outputPath])
}

rmSync(publicRoot, { recursive: true, force: true })
mkdirSync(publicRoot, { recursive: true })
mkdirSync(path.dirname(dataPath), { recursive: true })

const categories = categoryOrder.map(([id, label, folderName], categoryIndex) => {
  const categoryDir = path.join(sourceRoot, folderName)
  const outDir = path.join(publicRoot, id)
  mkdirSync(outDir, { recursive: true })

  const files = walk(categoryDir).filter((entryPath) => videoExtensions.has(path.extname(entryPath).toLowerCase()))

  const items = files.map((videoPath, itemIndex) => {
    const inspected = inspectVideo(videoPath)
    const sourcePoster = nearestPosterInSameFolder(videoPath)
    const slug = `${String(itemIndex + 1).padStart(2, '0')}-${slugify(titleFromFile(videoPath))}`
    const videoOut = path.join(outDir, `${slug}.mp4`)
    const posterOut = path.join(outDir, `${slug}-poster.jpg`)
    const orientation =
      categoryIndex === 1 && videoPath.toLowerCase().includes(`${path.sep}portrait${path.sep}`)
        ? 'portrait'
        : categoryIndex === 1 && videoPath.toLowerCase().includes(`${path.sep}landscape${path.sep}`)
          ? 'landscape'
          : inspected.orientation

    ensureWebVideo(videoPath, videoOut)
    ensurePoster(videoPath, sourcePoster, posterOut)

    return {
      id: slug,
      title: titleFromFile(videoPath),
      category: label,
      orientation,
      sourceSizeMb: Number((statSync(videoPath).size / 1024 / 1024).toFixed(2)),
      duration: formatDuration(inspected.duration),
      src: `/assets/product-videos/${id}/${path.basename(videoOut)}`,
      previewSrc: `/assets/product-videos/${id}/${path.basename(videoOut)}`,
      poster: `/assets/product-videos/${id}/${path.basename(posterOut)}`,
    }
  })

  return { id, label, number: String(categoryIndex + 1).padStart(2, '0'), items }
})

const content = `export const productVideoCategories = ${JSON.stringify(categories, null, 2)}

export const productModes = [
  { id: 'video', label: 'Video', icon: '/assets/project-icons/video_fill.png' },
  { id: '3d', label: '3D', icon: '/assets/project-icons/3d.png' },
  { id: 'graphic', label: 'Graphic', icon: '/assets/project-icons/graphic.png' },
]
`

writeFileSync(dataPath, content, 'utf8')

const totalItems = categories.reduce((sum, category) => sum + category.items.length, 0)
console.log(`Generated ${totalItems} product video records in ${dataPath}`)
