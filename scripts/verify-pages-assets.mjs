import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const distRoot = join(root, 'dist')
const maxAssetBytes = 25 * 1024 * 1024

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

const files = await walk(distRoot)
const oversizedFiles = []

const heroSource = await stat(join(root, 'public', 'assets', 'hero-preview.mp4'))
const heroOutput = await stat(join(distRoot, 'assets', 'hero-preview.mp4'))
if (heroSource.size !== heroOutput.size) {
  console.error(`Hero preview must be copied without transcoding: source=${heroSource.size}, output=${heroOutput.size}`)
  process.exit(1)
}

for (const file of files) {
  const size = (await stat(file)).size
  if (size > maxAssetBytes) {
    oversizedFiles.push({
      path: relative(root, file).replaceAll('\\', '/'),
      sizeMiB: size / 1024 / 1024,
    })
  }
}

if (oversizedFiles.length > 0) {
  console.error('Cloudflare Pages rejects single files larger than 25 MiB:')
  for (const file of oversizedFiles) {
    console.error(`- ${file.path} (${file.sizeMiB.toFixed(2)} MiB)`)
  }
  process.exit(1)
}

console.log(`All ${files.length} Pages assets are <= 25 MiB.`)
