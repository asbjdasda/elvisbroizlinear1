import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const chromePath =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const port = 9224
const targetUrl = process.argv[2] || 'http://127.0.0.1:4173/?video=01-3d-printed-saddle-promotional-video'
const portraitTargetUrl = 'http://127.0.0.1:4173/?video=09-ces-exhibition-tactile-sensorgallery-9-16-4k-en'

async function ensureSiteServer() {
  try {
    const response = await fetch('http://127.0.0.1:4173/')
    if (response.ok) return null
  } catch {
    // Start an isolated test server below.
  }

  const root = fileURLToPath(new URL('..', import.meta.url))
  const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
  const server = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
    windowsHide: true,
  })

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite test server exited with ${server.exitCode}`)
    try {
      const response = await fetch('http://127.0.0.1:4173/')
      if (response.ok) return server
    } catch {
      // Keep polling until Vite is ready.
    }
    await delay(100)
  }

  server.kill()
  throw new Error('Timed out waiting for the Vite test server')
}

function launchChrome(profilePath) {
  return spawn(chromePath, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${profilePath}`,
    '--remote-allow-origins=*',
    `--remote-debugging-port=${port}`,
    'about:blank',
  ], {
    stdio: 'ignore',
    windowsHide: true,
  })
}

async function fetchJson(url, attempts = 50, options = {}) {
  let lastError
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, options)
      if (response.ok) return response.json()
      lastError = new Error(`${response.status} ${response.statusText}`)
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw lastError
}

class CdpClient {
  constructor(wsUrl) {
    this.nextId = 1
    this.pending = new Map()
    this.events = new Map()
    this.socket = new WebSocket(wsUrl)
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', (event) => this.handleMessage(event))
  }

  handleMessage(event) {
    const message = JSON.parse(event.data)
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }

    const listeners = this.events.get(message.method)
    if (listeners) {
      for (const listener of listeners) listener(message.params)
    }
  }

  send(method, params = {}) {
    const id = this.nextId
    this.nextId += 1
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
    })
  }

  once(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const listener = (params) => {
        clearTimeout(timer)
        this.events.set(method, (this.events.get(method) || []).filter((item) => item !== listener))
        resolve(params)
      }
      const timer = setTimeout(() => {
        this.events.set(method, (this.events.get(method) || []).filter((item) => item !== listener))
        reject(new Error(`Timed out waiting for ${method}`))
      }, timeoutMs)

      this.events.set(method, [...(this.events.get(method) || []), listener])
    })
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed')
    }
    return result.result.value
  }

  close() {
    this.socket.close()
  }
}

async function waitFor(client, expression, timeoutMs = 25000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = await client.evaluate(expression)
    if (value) return value
    await delay(250)
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

const siteServer = await ensureSiteServer()
const chromeProfile = await mkdtemp(join(tmpdir(), 'brozien-video-modal-'))
const chrome = launchChrome(chromeProfile)

try {
  await fetchJson(`http://127.0.0.1:${port}/json/version`)
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, 10, { method: 'PUT' })
  const client = new CdpClient(target.webSocketDebuggerUrl)
  await client.open()
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  const loaded = client.once('Page.loadEventFired', 30000).catch(() => null)
  await client.send('Page.navigate', { url: targetUrl })
  await loaded

  await waitFor(client, "Boolean(document.querySelector('.video-modal__panel'))")
  await waitFor(client, "Boolean(document.querySelector('.video-player video'))")

  const initialState = await client.evaluate(`(() => {
    const video = document.querySelector('.video-player video')
    return {
      title: document.querySelector('.video-modal__topbar strong')?.textContent,
      modal: Boolean(document.querySelector('.video-modal__panel')),
      progress: Boolean(document.querySelector('.video-player__progress input')),
      timeTip: Boolean(document.querySelector('.video-player__time-tip')),
      primaryPlayButtons: document.querySelectorAll('.video-player__button--primary').length,
      fullscreenCloseButtons: document.querySelectorAll('.video-player__fullscreen-close').length,
      topbarOwnsTopLayer: (() => {
        const topbar = document.querySelector('.video-modal__topbar')
        const rect = topbar.getBoundingClientRect()
        const topElement = document.elementFromPoint(rect.left + Math.min(80, rect.width / 2), rect.top + rect.height / 2)
        return Boolean(topElement?.closest('.video-modal'))
      })(),
      controlsList: video?.getAttribute('controlsList') || '',
      contextMenuBlocked: video?.oncontextmenu !== null || video?.getAttribute('oncontextmenu') !== null,
      nativeControls: video?.controls,
      pictureInPictureDisabled: video?.disablePictureInPicture,
    }
  })()`)

  assert.equal(initialState.modal, true)
  assert.equal(initialState.progress, true)
  assert.equal(initialState.timeTip, true)
  assert.equal(initialState.primaryPlayButtons, 1)
  assert.equal(initialState.fullscreenCloseButtons, 0)
  assert.equal(initialState.topbarOwnsTopLayer, true)
  assert.equal(initialState.nativeControls, false)
  assert.equal(initialState.pictureInPictureDisabled, true)
  assert.match(initialState.controlsList, /nodownload/)

  const progressLayout = await client.evaluate(`(() => {
    const panel = document.querySelector('.video-modal__panel')
    const player = document.querySelector('.video-player')
    const progress = document.querySelector('.video-player__progress')
    const getState = () => {
      const playerRect = player.getBoundingClientRect()
      const progressRect = progress.getBoundingClientRect()
      const style = getComputedStyle(progress)
      return {
        bottomGap: Math.round(playerRect.bottom - progressRect.bottom),
        leftGap: Math.round(progressRect.left - playerRect.left),
        rightGap: Math.round(playerRect.right - progressRect.right),
        borderTopWidth: style.borderTopWidth,
        borderBottomWidth: style.borderBottomWidth,
      }
    }
    const normal = getState()
    panel.classList.add('is-fullscreen')
    const fullscreen = getState()
    panel.classList.remove('is-fullscreen')
    return { normal, fullscreen }
  })()`)

  assert.equal(progressLayout.normal.bottomGap, 0)
  assert.equal(progressLayout.fullscreen.bottomGap, 0)
  assert.equal(progressLayout.normal.leftGap, 0)
  assert.equal(progressLayout.normal.rightGap, 0)
  assert.equal(progressLayout.normal.borderTopWidth, '0px')
  assert.equal(progressLayout.normal.borderBottomWidth, '0px')

  await client.evaluate(`(() => {
    document.querySelector('.video-player video').dispatchEvent(new Event('play', { bubbles: true }))
  })()`)
  await waitFor(client, "document.querySelector('.video-player')?.classList.contains('has-hidden-controls')")

  const hoverReveal = await client.evaluate(`(() => {
    const player = document.querySelector('.video-player')
    const rect = player.getBoundingClientRect()
    player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: rect.top + rect.height * 0.25 }))
    const afterMiddle = player.classList.contains('has-hidden-controls')
    player.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientY: rect.bottom - 20 }))
    return { afterMiddle }
  })()`)

  assert.equal(hoverReveal.afterMiddle, true)
  await waitFor(client, "!document.querySelector('.video-player')?.classList.contains('has-hidden-controls')")

  await client.evaluate(`(() => {
    const progress = document.querySelector('.video-player__progress')
    const video = document.querySelector('.video-player video')
    Object.defineProperty(video, 'duration', { configurable: true, value: 125 })
    Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => 125 })
    progress.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: progress.getBoundingClientRect().left + progress.getBoundingClientRect().width * 0.716,
    }))
  })()`)

  await waitFor(client, "document.querySelector('.video-player__progress')?.classList.contains('is-previewing')")
  await waitFor(client, "document.querySelector('.video-player__time-tip')?.textContent === '01:29'")

  await client.evaluate(`(() => {
    const video = document.querySelector('.video-player video')
    window.__commentsPauseCalls = 0
    video.pause = () => { window.__commentsPauseCalls += 1 }
    document.querySelector('[aria-label="More video actions"]').click()
  })()`)
  await waitFor(client, "Boolean(document.querySelector('.video-player__menu'))")

  await client.evaluate("Array.from(document.querySelectorAll('.video-player__menu button')).find((button) => button.textContent.includes('Comments')).click()")
  await waitFor(client, "Boolean(document.querySelector('.video-popover--comments'))")
  assert.equal(await client.evaluate('window.__commentsPauseCalls'), 1)

  const commentsState = await client.evaluate(`(() => ({
    hasEpsExpandIcon: document.querySelector('.video-comments__expand-preview img')?.src.includes('/assets/ui/comments-expand.svg'),
    firstSeed: document.body.textContent.includes('帅帅帅帅帅帅帅帅帅帅帅帅'),
    secondSeed: document.body.textContent.includes('666666666666666'),
    visitorsPinnedRight: Boolean(document.querySelector('.video-comments__head b')),
    collapsedListHidden: document.querySelector('.video-comments__list')?.hidden === true,
    articleCount: document.querySelectorAll('.video-comments__list article').length,
    compactHeight: document.querySelector('.video-popover--comments').getBoundingClientRect().height <= 180,
    sendButtonHasFlyIcon: Boolean(document.querySelector('.video-comments__form button .video-comments__send-icon')),
    bottomWidePanel: (() => {
      const panel = document.querySelector('.video-modal__panel')
      const player = document.querySelector('.video-player')
      const comments = document.querySelector('.video-popover--comments')
      const panelRect = panel.getBoundingClientRect()
      const playerRect = player.getBoundingClientRect()
      const commentsRect = comments.getBoundingClientRect()
      const withinPanelX = commentsRect.left >= panelRect.left - 1 && commentsRect.right <= panelRect.right + 1
      const withinPlayerX = commentsRect.left >= playerRect.left - 1 && commentsRect.right <= playerRect.right + 1
      return commentsRect.width >= playerRect.width * 0.82
        && commentsRect.bottom <= playerRect.bottom - 22
        && withinPanelX
        && withinPlayerX
    })(),
  }))()`)

  assert.deepEqual(commentsState, {
    hasEpsExpandIcon: true,
    firstSeed: true,
    secondSeed: true,
    visitorsPinnedRight: true,
    collapsedListHidden: true,
    articleCount: 0,
    compactHeight: true,
    sendButtonHasFlyIcon: true,
    bottomWidePanel: true,
  })

  await client.evaluate("document.querySelector('.video-comments__expand-preview button')?.click()")
  await waitFor(client, "document.querySelector('.video-comments__list')?.hidden === false")

  await client.evaluate("document.querySelector('.video-popover__close').click()")
  await client.evaluate("document.querySelector('[aria-label=\"More video actions\"]').click()")
  await client.evaluate("Array.from(document.querySelectorAll('.video-player__menu button')).find((button) => button.textContent.includes('Share')).click()")
  await waitFor(client, "Boolean(document.querySelector('.video-popover--share'))")

  const shareState = await client.evaluate(`(() => ({
    targets: Array.from(document.querySelectorAll('.video-share__target em')).map((node) => node.textContent),
    icons: Array.from(document.querySelectorAll('.video-share__target img')).map((node) => {
      const src = node.getAttribute('src') || ''
      return src.startsWith('./') ? src.slice(2) : src.replace(/^\\//, '')
    }),
    link: document.querySelector('.video-share__link span')?.textContent || '',
  }))()`)

  assert.deepEqual(shareState.targets, ['Facebook', 'Instagram', 'X', 'YouTube'])
  assert.deepEqual(shareState.icons, [
    'assets/ui/social-facebook.jpg',
    'assets/ui/social-instagram.jpg',
    'assets/ui/social-x.jpg',
    'assets/ui/social-youtube.jpg',
  ])
  assert.match(shareState.link, /[?&]video=01-3d-printed-saddle-promotional-video/)

  const portraitLoaded = client.once('Page.loadEventFired', 30000).catch(() => null)
  await client.send('Page.navigate', { url: portraitTargetUrl })
  await portraitLoaded
  await waitFor(client, "Boolean(document.querySelector('.video-modal__panel--portrait'))")
  await waitFor(client, "Boolean(document.querySelector('.video-player video'))")

  const portraitState = await client.evaluate(`(() => {
    const panel = document.querySelector('.video-modal__panel--portrait')
    const title = document.querySelector('.video-modal__topbar strong')
    const player = document.querySelector('.video-player')
    const controls = document.querySelector('.video-player__controls')
    const progress = document.querySelector('.video-player__progress')
    const volumeInput = document.querySelector('.video-player__volume-slider input')
    const volumeSlider = document.querySelector('.video-player__volume-slider')
    const panelRect = panel.getBoundingClientRect()
    const titleStyle = getComputedStyle(title)
    const sliderStyle = getComputedStyle(volumeSlider)
    const bounds = [player, controls, progress].map((node) => {
      const rect = node.getBoundingClientRect()
      return {
        leftOverflow: Math.round(panelRect.left - rect.left),
        rightOverflow: Math.round(rect.right - panelRect.right),
      }
    })
    return {
      titleWhiteSpace: titleStyle.whiteSpace,
      titleFontSize: Number.parseFloat(titleStyle.fontSize),
      horizontalOverflow: bounds.some((item) => item.leftOverflow > 0 || item.rightOverflow > 0),
      volumeValue: volumeInput?.value,
      volumeSliderBackground: sliderStyle.backgroundColor,
      volumeSliderBorderTop: sliderStyle.borderTopWidth,
    }
  })()`)

  assert.notEqual(portraitState.titleWhiteSpace, 'nowrap')
  assert.ok(portraitState.titleFontSize <= 24)
  assert.equal(portraitState.horizontalOverflow, false)
  assert.equal(portraitState.volumeValue, '0.5')
  assert.match(portraitState.volumeSliderBackground, /rgba\(0, 0, 0, 0\)|transparent/)
  assert.equal(portraitState.volumeSliderBorderTop, '0px')

  client.close()
  console.log('video modal DOM verification passed.')
} finally {
  chrome.kill()
  siteServer?.kill()
  await rm(chromeProfile, { recursive: true, force: true }).catch(() => {})
}
