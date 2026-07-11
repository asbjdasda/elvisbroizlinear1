import { spawn } from 'node:child_process'
import process from 'node:process'

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
}

process.env.VNEXT_OPTIMIZED_BUILD = '1'
const { build } = await import('vite')
await build()

await run(process.execPath, ['scripts/prepare-vnext-assets.mjs'])
await run(process.execPath, ['scripts/verify-pages-assets.mjs'])
