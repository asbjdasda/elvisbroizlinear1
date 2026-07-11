export const DEFAULT_R2_ASSET_BASE = 'https://assets.elvisbroizlinear.com'

const productVideoPrefix = '/assets/product-videos/'
const productVideoPreviewPrefix = '/assets/product-video-previews/'

function isRemoteUrl(src) {
  return /^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')
}

function cleanBaseUrl(baseUrl = '/') {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function cleanAssetBase(assetBase = '') {
  return assetBase.replace(/\/$/, '')
}

export function mediaPath(src, { baseUrl = '/' } = {}) {
  if (!src) return ''
  if (isRemoteUrl(src)) return src
  return `${cleanBaseUrl(baseUrl)}${src.replace(/^\//, '')}`
}

export function productVideoPath(src, { baseUrl = '/', production = false, r2AssetBase = '', videoGatewayBase = '' } = {}) {
  if (!src) return ''
  if (isRemoteUrl(src)) return src

  const gatewayBase = cleanAssetBase(videoGatewayBase)
  if (src.startsWith(productVideoPrefix) && gatewayBase) return `${gatewayBase}${src}`

  const assetBase = cleanAssetBase(r2AssetBase || (production ? DEFAULT_R2_ASSET_BASE : ''))
  if (src.startsWith(productVideoPrefix) && assetBase) return `${assetBase}${src}`

  return mediaPath(src, { baseUrl })
}

export function productVideoPreviewPath(item, options = {}) {
  const src = item?.previewSrc || item?.src
  if (!src) return ''
  if (isRemoteUrl(src)) return src
  if (options.production && src.startsWith(productVideoPrefix)) {
    return mediaPath(src.replace(productVideoPrefix, productVideoPreviewPrefix), options)
  }
  return mediaPath(src, options)
}
