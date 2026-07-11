import assert from 'node:assert/strict'
import { mediaPath, productVideoPath, productVideoPreviewPath } from '../src/utils/mediaPaths.js'

assert.equal(
  productVideoPath('/assets/product-videos/3d-motion/demo.mp4', { production: true, baseUrl: '/' }),
  'https://assets.elvisbroizlinear.com/assets/product-videos/3d-motion/demo.mp4',
)

assert.equal(
  productVideoPath('/assets/product-videos/3d-motion/demo.mp4', {
    production: true,
    baseUrl: '/',
    r2AssetBase: 'https://media.example.com/',
  }),
  'https://media.example.com/assets/product-videos/3d-motion/demo.mp4',
)

assert.equal(
  productVideoPath('/assets/product-videos/3d-motion/demo.mp4', {
    production: true,
    baseUrl: '/',
    r2AssetBase: 'https://media.example.com/',
    videoGatewayBase: 'https://video.example.com/',
  }),
  'https://video.example.com/assets/product-videos/3d-motion/demo.mp4',
)

assert.equal(
  productVideoPath('/assets/product-videos/3d-motion/demo.mp4', { production: false, baseUrl: '/preview/' }),
  '/preview/assets/product-videos/3d-motion/demo.mp4',
)

assert.equal(
  mediaPath('/assets/product-videos/3d-motion/demo-poster.jpg', { production: true, baseUrl: '/' }),
  '/assets/product-videos/3d-motion/demo-poster.jpg',
)

assert.equal(
  productVideoPath('https://cdn.example.com/demo.mp4', { production: true, baseUrl: '/' }),
  'https://cdn.example.com/demo.mp4',
)

assert.equal(
  productVideoPreviewPath({ src: '/assets/product-videos/3d-motion/demo.mp4' }, { production: true, baseUrl: '/' }),
  '/assets/product-video-previews/3d-motion/demo.mp4',
)

console.log('media path helpers resolve local, production R2, custom R2, poster, and absolute URLs correctly.')
