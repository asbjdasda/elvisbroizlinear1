# Email sign-in

The portfolio uses the Cloudflare auth Worker at `https://auth.elvisbroizlinear.com` for passwordless sign-in and registration. The Worker sends six-digit codes through Cloudflare Email Sending and stores only a short-lived hash in KV.

1. Keep Email Sending enabled for `elvisbroizlinear.com`, with SPF, DKIM and DMARC records published.
2. Keep the destination address verified in Cloudflare Email Routing for free-plan test delivery.
3. Deploy `workers/wrangler.auth-gateway.jsonc` with a private `CODE_SECRET` and the `AUTH_CODES` KV namespace.
4. Request a code from Sign Up or Log in. Open the delivered email and enter the six-digit code on the requesting site. A successful code is single-use and expires after ten minutes.
5. The site stores only a short-lived local session marker in the browser. Likes and comments use per-film local storage on the current device.

If the auth Worker is unavailable, the form reports the delivery error and does not claim that a message was sent.
