const AUTH_API = import.meta.env.VITE_AUTH_API_URL || 'https://auth.elvisbroizlinear.com'
const SESSION_KEY = 'brozien-auth-session'
const listeners = new Set()

function notify() {
  const signedIn = Boolean(localStorage.getItem(SESSION_KEY))
  listeners.forEach(listener => listener('SIGNED_IN', signedIn ? { access_token: 'local' } : null))
}

async function request(path, body) {
  const response = await fetch(`${AUTH_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.message || 'The service could not be reached. Please try again.')
    Object.assign(error, payload, { status: response.status })
    throw error
  }
  return payload
}

export const emailAuth = {
  onAuthStateChange(listener) {
    listeners.add(listener)
    listener('INITIAL_SESSION', localStorage.getItem(SESSION_KEY) ? { access_token: 'local' } : null)
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
  },
  async signInWithOtp({ email }) { return { data: await request('/otp', { email }), error: null } },
  async verifyOtp({ email, token }) {
    const data = await request('/verify', { email, code: token })
    localStorage.setItem(SESSION_KEY, data.session)
    notify()
    return { data: { session: data }, error: null }
  },
  async signOut() {
    localStorage.removeItem(SESSION_KEY)
    notify()
    return { error: null }
  },
}

export function errorMessage(error) {
  if (error?.status === 429) return 'Too many requests. Please wait before trying again.'
  if (error?.code === 'otp_expired' || error?.status === 403) return 'This code is invalid or has expired. Request a new code and try again.'
  return error?.message || 'The service could not be reached. Please try again.'
}
