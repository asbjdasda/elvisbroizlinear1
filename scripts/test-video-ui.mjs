import assert from 'node:assert/strict'
import {
  buildVideoShareUrl,
  formatVideoTime,
  getBufferedPercent,
  pointerPercentFromRect,
  trimComments,
} from '../src/utils/videoUi.js'

const manyComments = Array.from({ length: 23 }, (_, index) => ({ id: index, text: `comment-${index}` }))
assert.deepEqual(
  trimComments(manyComments).map((comment) => comment.id),
  manyComments.slice(0, 20).map((comment) => comment.id),
)

assert.deepEqual(
  trimComments(manyComments, 18).map((comment) => comment.id),
  manyComments.slice(0, 18).map((comment) => comment.id),
)

assert.equal(
  buildVideoShareUrl('01-demo-video', {
    origin: 'https://elvisbroizlinear.com',
    pathname: '/',
  }),
  'https://elvisbroizlinear.com/?video=01-demo-video',
)

assert.equal(
  buildVideoShareUrl('01-demo-video', {
    origin: 'https://elvisbroizlinear.com',
    pathname: '/portfolio/',
    search: '?foo=bar&video=old',
  }),
  'https://elvisbroizlinear.com/portfolio/?foo=bar&video=01-demo-video',
)

assert.equal(getBufferedPercent({ duration: 100, bufferedRanges: [[0, 32], [50, 70]] }), 70)
assert.equal(getBufferedPercent({ duration: 0, bufferedRanges: [[0, 32]] }), 0)
assert.equal(getBufferedPercent({ duration: 100, bufferedRanges: [] }), 0)

assert.equal(formatVideoTime(0), '00:00')
assert.equal(formatVideoTime(2), '00:02')
assert.equal(formatVideoTime(89), '01:29')
assert.equal(formatVideoTime(125), '02:05')
assert.equal(formatVideoTime(3723), '1:02:03')
assert.equal(formatVideoTime(Number.NaN), '00:00')

assert.equal(pointerPercentFromRect({ clientX: 50, left: 0, width: 100 }), 50)
assert.equal(pointerPercentFromRect({ clientX: -20, left: 0, width: 100 }), 0)
assert.equal(pointerPercentFromRect({ clientX: 220, left: 20, width: 100 }), 100)
assert.equal(pointerPercentFromRect({ clientX: 50, left: 0, width: 0 }), 0)

console.log('video UI helpers trim comments, build links, calculate progress, and format time correctly.')
