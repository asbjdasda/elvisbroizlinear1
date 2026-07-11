# Cloudflare production deployment: Pages + private R2 video Worker

## Final architecture

- `https://elvisbroizlinear.com` and `https://www.elvisbroizlinear.com`: Cloudflare Pages site.
- `https://video.elvisbroizlinear.com`: Worker custom domain for videos.
- R2 bucket `elvisbroizlinear`: private; it has no `r2.dev` public URL.
- Product cards use the small files under `/assets/product-video-previews/`.
- Full product videos are requested from the Worker only after a visitor opens a video modal.
- Hero `/assets/cliff-life.mp4` is 3,971,322 bytes and is copied without transcoding.

The Worker URL is stable per object. It does not generate per-visitor `exp` or `sig` query strings. The Worker cache key is the normalized R2 object key plus the requested byte range, so repeated video segments can be served from the edge cache.

## 1. Check R2 object layout

In Cloudflare Dashboard, open **R2 Object Storage > elvisbroizlinear**. Keep the bucket private and confirm full videos use exactly this key layout:

```text
assets/product-videos/<category>/<filename>.mp4
```

Do not enable the `r2.dev` public development URL. Do not connect a public R2 custom domain to this private bucket. The production custom domain belongs to the Worker, which reads the private bucket through an R2 binding.

## 2. Authenticate Wrangler locally

Open PowerShell in the repository root and run:

```powershell
cd "E:\Tatol_files_personal\Brozien web\GitHub Elvis\elvisbroizlinear"
npx wrangler login
npx wrangler whoami
```

The browser login must select the Cloudflare account that owns `elvisbroizlinear.com` and the `elvisbroizlinear` R2 bucket. Administrator mode is not required. There is no video signing secret in this design.

## 3. Deploy the private video Worker

The Worker configuration already contains:

- Worker name: `elvisbroizlinear-video-gateway`
- R2 binding: `VIDEOS`
- R2 bucket: `elvisbroizlinear`
- route: `video.elvisbroizlinear.com/*`
- allowed origins: apex and `www`

Deploy it:

```powershell
npx wrangler deploy --config workers/wrangler.video-gateway.jsonc
```

Then open **Workers & Pages > elvisbroizlinear-video-gateway > Settings > Domains & Routes**. Confirm the custom domain or route is `video.elvisbroizlinear.com`. Cloudflare should create/proxy its DNS record. Do not create a second unproxied record with the same name.

## 4. Configure Pages environment variables

Open **Workers & Pages > your Pages project > Settings > Variables and Secrets**. Add this variable to both Production and Preview if previews must play R2 videos:

```text
VITE_VIDEO_GATEWAY_BASE=https://video.elvisbroizlinear.com
```

This is a public build-time URL, not a secret. No `VIDEO_SIGNING_SECRET`, R2 access key, account token, or API token belongs in Pages.

Recommended Pages Git settings:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Root directory: /
Production branch: main
Node version: 22 or current Pages-supported LTS
```

Trigger a new deployment after adding the variable. An old deployment cannot see a newly added Vite environment variable.

## 5. Attach the site domains

In **Workers & Pages > Pages project > Custom domains**, add both:

```text
elvisbroizlinear.com
www.elvisbroizlinear.com
```

Let Pages create the DNS records. In **DNS > Records**, both records must be proxied. Remove only conflicting duplicate records after confirming they point to an old host. Keep the `video` Worker record separate.

In **SSL/TLS > Overview**, use **Full (strict)**. Enable **Always Use HTTPS** and **Automatic HTTPS Rewrites**. Cloudflare manages the browser-facing certificates for the Pages and Worker custom domains; no manual certificate upload is required.

## 6. Cache and speed settings

The Worker sends these headers for full and ranged video responses:

```text
Cache-Control: public, max-age=31536000, immutable
Cloudflare-CDN-Cache-Control: public, max-age=31536000, immutable
Accept-Ranges: bytes
Content-Disposition: inline
```

The Worker also caches by normalized object key and byte range. Query strings such as old `exp`/`sig` values are excluded from its internal cache key.

Recommended zone settings:

1. **Speed > Optimization > Protocol Optimization**: enable HTTP/2, HTTP/3 (QUIC), and 0-RTT if available on the current plan.
2. **Speed > Optimization > Content Optimization**: enable Brotli and Early Hints. Compression affects HTML/CSS/JS, not already-compressed MP4 files.
3. **Caching > Configuration**: keep the standard cache level. Browser Cache TTL may remain at Respect Existing Headers because the Worker sets explicit video headers.
4. **Network**: enable WebSockets and IPv6 compatibility. They do not materially accelerate MP4, but are safe platform defaults.
5. Do not buy Argo solely for this video pipeline until cache-hit tests and real-user measurements show an origin-routing problem. Cached R2 segments are already served at Cloudflare's edge.

Do not create a Cache Rule that ignores `Range`. Different byte ranges contain different data. The Worker already normalizes each valid range to its own cache entry.

## 7. Verify the Worker and cache hit

Replace the example object path with an object that exists in R2. Run the same command twice from PowerShell:

```powershell
$url = "https://video.elvisbroizlinear.com/assets/product-videos/3d-motion/01-3d-printed-saddle-promotional-video.mp4"
curl.exe -sS -D - -o NUL -H "Range: bytes=0-1048575" $url
curl.exe -sS -D - -o NUL -H "Range: bytes=0-1048575" $url
```

Expected response details:

```text
HTTP/2 206
accept-ranges: bytes
content-range: bytes 0-1048575/<total-size>
cache-control: public, max-age=31536000, immutable
cf-cache-status: MISS   # first request in that Cloudflare location
cf-cache-status: HIT    # repeated request for the same range
```

Cloudflare caches are regional. A first request from another city or after eviction can return `MISS`; that is normal. A second immediate request from the same connection and same byte range is the meaningful test. The repository's local Worker test verifies the cache-key and HIT behavior, but only the deployed URL can confirm the real Cloudflare response header.

## 8. Verify the complete site

1. Open `https://elvisbroizlinear.com` in a private browser window.
2. Confirm the Hero starts without requesting any `/assets/product-videos/` object.
3. Scroll to Video and confirm only `/assets/product-video-previews/` files load for cards.
4. Open one video and confirm a request starts at `https://video.elvisbroizlinear.com/assets/product-videos/...`.
5. Confirm the video request has no `exp` or `sig` query string.
6. Test `https://www.elvisbroizlinear.com` and verify it loads with a valid certificate and can play the same video.
7. In Cloudflare **Analytics & Logs > Web Analytics**, add the Pages site if it is not already present. Traffic data may take several minutes to appear; the dashboard is analytics, not a deployment-success requirement.

## Security boundary

Private R2 plus a Worker prevents a permanent public R2 object endpoint, but it is not DRM. Any browser that can play a video receives its bytes and a determined visitor can capture them. `controlsList="nodownload"`, disabled context menus, and inline disposition reduce casual downloading only. Real DRM requires a DRM-capable streaming service such as a protected streaming platform, not blockchain or expiring URLs alone.
