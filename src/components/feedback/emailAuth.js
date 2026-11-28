import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const emailAuth = url && key ? createClient(url, key).auth : null

export function errorMessage(error) {
  if (error?.status === 429) return 'Too many requests. Please wait before trying again.'
  if (error?.code === 'otp_expired' || error?.status === 403) return 'This code is invalid or has expired. Request a new code and try again.'
  return error?.message || 'The service could not be reached. Please try again.'
}
