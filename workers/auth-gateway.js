const CODE_TTL_SECONDS = 600
const MAX_ATTEMPTS = 5
const CODE_PATTERN = /^\d{6}$/

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || ''
  const origins = allowedOrigins(env)
  const allowOrigin = origins.includes(origin) ? origin : origins[0] || '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request, env), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function randomCode() {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return String(values[0] % 1000000).padStart(6, '0')
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function sendCode(request, env, body) {
  const email = normalizeEmail(body.email)
  if (!validEmail(email)) return json(request, env, { message: 'Please enter a valid email address.' }, 400)
  const key = `code:${await digest(email)}`
  const existing = await env.AUTH_CODES.get(key, 'json')
  if (existing?.sentAt && Date.now() - existing.sentAt < 60000) {
    return json(request, env, { message: 'Please wait before requesting another code.' }, 429)
  }

  const code = randomCode()
  const codeHash = await digest(`${email}:${code}:${env.CODE_SECRET}`)
  await env.AUTH_CODES.put(key, JSON.stringify({ codeHash, sentAt: Date.now(), attempts: 0 }), {
    expirationTtl: CODE_TTL_SECONDS,
  })

  try {
    await env.EMAIL.send({
      to: email,
      from: { email: env.SENDER_EMAIL, name: 'Brozien' },
      subject: 'Your Brozien verification code',
      text: `Your Brozien verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Brozien verification code is <strong style="font-size:22px;letter-spacing:4px">${code}</strong>.</p><p>This code expires in 10 minutes.</p>`,
    })
  } catch (error) {
    await env.AUTH_CODES.delete(key)
    return json(request, env, { message: 'The verification email could not be sent. Please try again later.', code: error?.code }, 502)
  }

  return json(request, env, { ok: true, expiresIn: CODE_TTL_SECONDS })
}

async function verifyCode(request, env, body) {
  const email = normalizeEmail(body.email)
  const code = String(body.code || '').trim()
  if (!validEmail(email) || !CODE_PATTERN.test(code)) {
    return json(request, env, { message: 'Enter the six-digit verification code.' }, 400)
  }
  const key = `code:${await digest(email)}`
  const record = await env.AUTH_CODES.get(key, 'json')
  if (!record) return json(request, env, { code: 'otp_expired', message: 'This code is invalid or has expired.' }, 403)
  if (record.attempts >= MAX_ATTEMPTS) {
    await env.AUTH_CODES.delete(key)
    return json(request, env, { code: 'otp_expired', message: 'Too many attempts. Request a new code.' }, 429)
  }
  const expected = await digest(`${email}:${code}:${env.CODE_SECRET}`)
  if (expected !== record.codeHash) {
    await env.AUTH_CODES.put(key, JSON.stringify({ ...record, attempts: record.attempts + 1 }), { expirationTtl: CODE_TTL_SECONDS })
    return json(request, env, { code: 'otp_expired', message: 'This code is invalid or has expired.' }, 403)
  }
  await env.AUTH_CODES.delete(key)
  return json(request, env, { ok: true, session: crypto.randomUUID() })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) })
    if (request.method !== 'POST') return json(request, env, { message: 'Method not allowed.' }, 405)
    let body
    try { body = await request.json() } catch { return json(request, env, { message: 'Invalid JSON.' }, 400) }
    const path = new URL(request.url).pathname
    if (path === '/otp') return sendCode(request, env, body)
    if (path === '/verify') return verifyCode(request, env, body)
    return json(request, env, { message: 'Not found.' }, 404)
  },
}
