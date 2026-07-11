import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const optimizedStaticBuild = process.env.VNEXT_OPTIMIZED_BUILD === '1'

// https://vite.dev/config/
export default defineConfig({
  root: projectRoot,
  base: './',
  publicDir: optimizedStaticBuild ? false : 'public',
  plugins: [react()],
})
