# R2 Video Delivery Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 35 existing production R2 videos at their existing object keys, add Halloween as the seventh 3D Motion item, and deliver all 36 as fast-start, web-friendly MP4 files that start and seek reliably on slower connections.

**Architecture:** Keep the private R2 bucket, Worker gateway, existing public URLs, and React player unchanged. Add Halloween's site data, poster, preview, and R2 key, plus one explicit source manifest and one delivery CLI that prepares, verifies, and uploads exactly the 36 published videos; verification is a mandatory gate before upload.

**Tech Stack:** Node.js ESM, bundled FFmpeg/libx264/AAC, Wrangler 4, Cloudflare R2, existing Node assertion tests.

---

### Task 1: Lock the published source-to-object mapping

**Files:**
- Create: `scripts/product-video-sources.mjs`
- Test: `scripts/test-video-delivery.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing mapping test**

Import `productVideoCategories` and the explicit source manifest. Assert that all 36 `item.src` values have exactly one source entry, no extra source entry exists, the stable showreel key maps to `Motion Graphics/The art of creative editing.mp4`, and Halloween is the seventh 3D Motion item.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node scripts/test-video-delivery.mjs`

Expected: FAIL because `product-video-sources.mjs` does not exist.

- [ ] **Step 3: Add the explicit 36-entry manifest**

Export `SOURCE_ROOT` and `PRODUCT_VIDEO_SOURCES`, keyed by the exact `/assets/product-videos/...` path already present in `src/data/productVideos.js`. Do not scan or include `Halloween Big Mouth Monster LEGO.mp4`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node scripts/test-video-delivery.mjs`

Expected: PASS for the stable manifest assertions.

### Task 2: Implement prepare and verification behavior with TDD

**Files:**
- Create: `scripts/video-delivery.mjs`
- Modify: `scripts/test-video-delivery.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add failing unit tests**

Cover these exported behaviors before implementation:

```js
assert.equal(needsTranscode({ bitrateKbps: 6001, videoCodec: 'h264', audioCodec: 'aac', width: 1920, height: 1080 }), true)
assert.equal(needsTranscode({ bitrateKbps: 900, videoCodec: 'h264', audioCodec: 'aac', width: 1920, height: 1080 }), false)
assert.equal(needsTranscode({ bitrateKbps: 5700, videoCodec: 'hevc', audioCodec: 'aac', width: 1920, height: 1080 }), true)
assert.deepEqual(topLevelAtomOrder(fastStartFixture), ['ftyp', 'moov', 'mdat'])
assert.deepEqual(topLevelAtomOrder(tailMoovFixture), ['ftyp', 'mdat'])
```

Also assert that transcode arguments select H.264/AAC, capped CRF with `6M` maximum rate, `yuv420p`, two-second forced keyframes, orientation-aware 1080p limits, and `+faststart`; remux arguments must use `-c copy` and `+faststart`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node scripts/test-video-delivery.mjs`

Expected: FAIL because the delivery helpers do not exist.

- [ ] **Step 3: Implement the delivery CLI**

Commands:

```powershell
npm run video:prepare
npm run video:verify
npm run video:upload -- --wrangler <absolute-wrangler.cmd>
```

`prepare` must inspect each source with FFmpeg, remux five already-compatible low-bitrate videos, transcode every file over 6 Mbps or with HEVC/non-AAC/oversized dimensions, and write exactly 36 MP4 files beneath ignored `tmp-product-video-delivery/` using the stable R2 key layout plus Halloween's new key. Transcodes use `libx264`, CRF 21, `maxrate 5800k` (leaving room for audio and container overhead below the 6.5 Mbps total gate), `bufsize 12M`, AAC 160 kbps, `yuv420p`, two-second forced keyframes, and faststart.

`verify` must reject missing/extra keys, non-H.264 video, non-AAC audio, dimensions above 1920x1080 landscape or 1080x1920 portrait, total bitrate above 6.5 Mbps, or `moov` not preceding `mdat`.

`upload` must call the same verifier first and stop on the first failed `wrangler r2 object put elvisbroizlinear/<key> --file <file> --content-type video/mp4 --remote` command.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node scripts/test-video-delivery.mjs`

Expected: PASS.

### Task 3: Prepare and verify all delivery files

**Files:**
- Generated and ignored: `tmp-product-video-delivery/assets/product-videos/**/*.mp4`

- [ ] **Step 1: Run one landscape and one portrait compatibility sample**

Use the production CLI's FFmpeg argument builder on one landscape and one portrait source. Verify both complete with the bundled 2018 FFmpeg before starting the full batch.

- [ ] **Step 2: Run the full preparation**

Run: `npm run video:prepare`

Expected: 36 outputs, 31 transcodes, 5 remuxes, no source-key drift.

- [ ] **Step 3: Run the mandatory media verification**

Run: `npm run video:verify`

Expected: all 36 files pass codec, bitrate, resolution, key, and atom-order gates.

### Task 4: Document and deploy the R2 replacement

**Files:**
- Modify: `docs/r2-private-video-worker.md`
- Modify: `package.json`

- [ ] **Step 1: Document the guarded workflow**

Document the explicit mapping, ignored output directory, prepare/verify/upload commands, 6 Mbps policy, stable object keys, and remote HEAD/range checks. State that `generate-product-assets.js` must not be used for R2 delivery because it scans and regenerates IDs instead of preserving the explicit manifest.

- [ ] **Step 2: Run repository verification before upload**

Run: `npm run lint`, `npm test`, and `npm run build:full`.

Expected: all exit 0.

- [ ] **Step 3: Upload the verified files**

Run the guarded `video:upload` command with the repaired Wrangler 4 binary. Do not deploy the Worker because this task does not change Worker code.

- [ ] **Step 4: Verify production**

For all 36 URLs, verify `HEAD 200`, byte-range `206`, expected content length, changed ETag for replaced objects, H.264/AAC metadata, and faststart. Repeat representative 1 MiB ranges to confirm `MISS -> HIT`, then open the live site and confirm representative landscape/portrait modal playback without media errors.

- [ ] **Step 5: Evaluate Worker HEAD/Range behavior**

Compare measured warm-range latency after the media replacement. Modify the Worker only if the media fix leaves reproducible, material delay attributable to the Worker rather than network throughput; otherwise record that no Worker source change was justified.

### Task 5: Commit the permanent source changes

**Files:**
- Commit only source, tests, package scripts, plan, and documentation.
- Exclude: `tmp-product-video-delivery/`, credentials, caches, and generated large MP4 files.

- [ ] **Step 1: Review the exact diff and status**

Run: `git diff --check`, `git status --short`, and inspect every changed file.

- [ ] **Step 2: Commit with the user-specified message**

```powershell
git add package.json scripts/product-video-sources.mjs scripts/video-delivery.mjs scripts/test-video-delivery.mjs docs/r2-private-video-worker.md docs/superpowers/plans/2026-08-15-r2-video-delivery-optimization.md
git commit -m "第13次大改"
```

- [ ] **Step 3: Verify the commit**

Run: `git show --stat --oneline HEAD` and `git status --short`.

Expected: commit message `第13次大改`; clean worktree; no large delivery MP4 files committed.
