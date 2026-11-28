import { useEffect, useRef, useState } from 'react'
import { Check, Mail, X } from 'lucide-react'
import CodeSlots from './CodeSlots'
import SwipeToast from './SwipeToast'
import { emailAuth, errorMessage } from './emailAuth'

export default function AuthModal({ mode, onClose, onSwitch }) {
  const signup = mode === 'signup'
  const [address, setAddress] = useState('')
  const [stage, setStage] = useState('address')
  const [status, setStatus] = useState('idle')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const email = address.trim()
  const closeRef = useRef(onClose)

  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = [document.body.style.overflow, document.documentElement.style.overflow]
    document.body.style.overflow = document.documentElement.style.overflow = 'hidden'
    const handleEscape = event => { if (event.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', handleEscape)
    return () => {
      ;[document.body.style.overflow, document.documentElement.style.overflow] = previous
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(c => Math.max(0, c - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function sendCode(event) {
    event?.preventDefault()
    if (pending.current || cooldown > 0) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!emailAuth) {
      setError('Email sign-in is temporarily unavailable. Please try again later.')
      return
    }
    pending.current = true
    setBusy(true)
    setError('')
    setMessage(null)
    try {
      const { error: failure } = await emailAuth.signInWithOtp({ email, options: { shouldCreateUser: signup } })
      if (failure) throw failure
      setStage('code')
      setStatus('idle')
      setAttempt(n => n + 1)
      setCooldown(60)
      setMessage({ title: 'Check your inbox', description: 'Your sign-in code was requested. Check your spam folder too.', icon: <Mail size={18} /> })
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  async function verifyCode(token) {
    if (!emailAuth || pending.current || status === 'success') return
    pending.current = true
    setBusy(true)
    setError('')
    setStatus('idle')
    setMessage(null)
    try {
      const { data, error: failure } = await emailAuth.verifyOtp({ email, token, type: 'email' })
      if (failure) throw failure
      if (!data.session) throw new Error('Sign-in could not be completed. Request a new code.')
      setStatus('success')
      setMessage({ title: 'Email verified', description: 'You are signed in.', icon: <Check size={18} /> })
    } catch (failure) {
      setStatus('error')
      setError(errorMessage(failure))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
      <button className="auth-modal__backdrop" type="button" aria-label="Close authentication modal" onClick={onClose} />
      <div className="auth-modal__panel motion-card">
        <button className="auth-modal__close" type="button" aria-label="Close authentication modal" onClick={onClose}><X size={18} /></button>
        <div className="auth-modal__brand">
          <img src={import.meta.env.BASE_URL + 'assets/brozien-identity-mark.png'} alt="" /><span>Brozien</span>
        </div>
        <div className="auth-form">
          <div className="auth-form__head">
            <span>{signup ? 'Create access' : 'Welcome back'}</span>
            <h2 id="auth-heading">{stage === 'address' ? (signup ? 'Sign Up' : 'Log in') : status === 'success' ? 'Email verified' : 'Enter your code'}</h2>
          </div>
          {stage === 'address' ? (
            <form className="auth-form" onSubmit={sendCode} noValidate>
              <label className="auth-field"><span>E-mail</span>
                <input autoFocus required type="email" autoComplete="email" value={address} disabled={busy} onChange={e => { setAddress(e.target.value); setError('') }} placeholder="name@example.com" />
              </label>
              <button className="auth-form__submit" type="submit" disabled={busy}>{busy ? 'Requesting…' : 'Send verification code'}</button>
            </form>
          ) : (
            <>
              <p className="auth-form__status">{status === 'success' ? 'Signed in as ' : 'Enter the six-digit code sent to '}{email}.</p>
              <CodeSlots key={attempt} autoFocus status={status} disabled={busy} onChange={code => { if (code && status === 'error') setStatus('idle') }} onComplete={verifyCode} slotSize={36} gap={6} />
              {status === 'success'
                ? <button className="auth-form__submit" type="button" onClick={onClose}>Continue</button>
                : <p className="auth-form__switch"><button type="button" disabled={busy || cooldown > 0} onClick={sendCode}>{cooldown > 0 ? 'Resend in ' + cooldown + 's' : 'Resend code'}</button><button type="button" disabled={busy} onClick={() => { setStage('address'); setCooldown(0); setMessage(null); setError('') }}>Change email</button></p>}
            </>
          )}
          {error && <p className="auth-form__status" role="alert">{error}</p>}
          {stage === 'address' && <p className="auth-form__switch">{signup ? 'Already have an account?' : "Don't have an account?"}<button disabled={busy} type="button" onClick={() => onSwitch(signup ? 'login' : 'signup')}>{signup ? 'Log in' : 'Sign up'}</button></p>}
        </div>
      </div>
      {message && <SwipeToast {...message} onClose={() => setMessage(null)} closeButton />}
    </div>
  )
}
