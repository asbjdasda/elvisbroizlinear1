import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [component, css, wrangler] = await Promise.all([
  readFile(new URL('../src/components/VideoModal.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/video-modal-final.css', import.meta.url), 'utf8'),
  readFile(new URL('../workers/wrangler.video-gateway.jsonc', import.meta.url), 'utf8'),
])

const config = JSON.parse(wrangler)
assert.deepEqual(config.routes, [{
  pattern: 'video.elvisbroizlinear.com',
  custom_domain: true,
}])

assert.match(
  component,
  /useEffect\(\(\) => \{[\s\S]*?activePanel[\s\S]*?videoRef\.current\?\.pause\(\)[\s\S]*?\}, \[activePanel\]\)/,
  'comment pause must follow committed panel state',
)
const openPanelBody = component.match(/function openPanel\(panel\) \{([\s\S]*?)\n  \}/)?.[1] || ''
assert.match(openPanelBody, /setIsPlaying\(false\)/)

const commentListBody = component.match(/className="video-comments__list"[\s\S]*?\{([a-zA-Z]+)\.length \?/m)?.[1]
assert.equal(commentListBody, 'comments', 'expanded history must not repeat the pinned default comments')

const volumeBaseDefinitions = css.match(/^\.video-player__volume-slider \{/gm) || []
assert.equal(volumeBaseDefinitions.length, 1, 'volume slider must have one authoritative base definition')

const collapsedRule = css.match(/\.video-popover--comments:not\(\.is-expanded\) \{([\s\S]*?)\}/)?.[1] || ''
assert.match(collapsedRule, /height:\s*auto/)
assert.match(collapsedRule, /max-height:\s*180px/)

console.log('video modal contracts enforce custom domain routing, comment pause/deduplication, and stable compact controls.')
