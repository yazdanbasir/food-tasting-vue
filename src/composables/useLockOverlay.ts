import { ref } from 'vue'
import { organizerLogin, setOnUnauthorized } from '@/api/organizer'
import { lookupSubmissionByPhone } from '@/api/submissions'
import type { SubmissionResponse } from '@/api/submissions'

const STORAGE_KEY = 'organizer_unlocked'
const CORRECT_PASSWORD = 'disney1994'

function getStorage(): Storage | undefined {
  return typeof window !== 'undefined' ? window.localStorage : undefined
}

const isLocked = ref(getStorage()?.getItem(STORAGE_KEY) !== 'true')

let isReauthing = false

/**
 * On 401: silently re-authenticate with the known credentials and store a fresh token.
 * The user stays on the page — no password prompt. Only re-locks if re-auth itself fails.
 */
async function handleSessionExpired(): Promise<void> {
  if (isReauthing) return
  isReauthing = true
  const storage = getStorage()
  if (storage) {
    storage.removeItem('organizer_token')
    storage.removeItem('organizer_username')
  }
  const apiUser = (import.meta.env.VITE_ORGANIZER_API_USERNAME as string | undefined) ?? 'organizer'
  const apiPass = (import.meta.env.VITE_ORGANIZER_API_PASSWORD as string | undefined) ?? CORRECT_PASSWORD
  try {
    const result = await organizerLogin(apiUser, apiPass)
    if (storage) {
      storage.setItem('organizer_token', result.token)
      storage.setItem('organizer_username', result.username)
    }
  } catch {
    if (storage) {
      storage.removeItem(STORAGE_KEY)
    }
    isLocked.value = true
    console.warn('[Organizer Auth] Silent re-auth failed; clearing unlock state and re-locking overlay.')
  } finally {
    isReauthing = false
  }
}

async function bootstrapOrganizerToken(): Promise<void> {
  const storage = getStorage()
  if (!storage) return
  const isUnlocked = storage.getItem(STORAGE_KEY) === 'true'
  const hasToken = !!storage.getItem('organizer_token')
  if (isUnlocked && !hasToken) {
    await handleSessionExpired()
  }
}

setOnUnauthorized(() => { void handleSessionExpired() })
void bootstrapOrganizerToken()

export function useLockOverlay() {
  function verifyPassword(pwd: string): boolean {
    return pwd === CORRECT_PASSWORD
  }

  /** Unlock the overlay. Fetches organizer token so edits and deletes work. Only unlocks if login succeeds. */
  async function unlock(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const apiUser = import.meta.env.VITE_ORGANIZER_API_USERNAME as string | undefined
    const apiPass = import.meta.env.VITE_ORGANIZER_API_PASSWORD as string | undefined
    const username = apiUser ?? 'organizer'
    const pass = apiPass ?? password
    console.log('[Organizer Auth]', 'unlock: attempting organizer login', { username, hasApiPass: !!apiPass })
    try {
      const result = await organizerLogin(username, pass)
      const storage = getStorage()
      if (storage) {
        storage.setItem('organizer_token', result.token)
        storage.setItem('organizer_username', result.username)
        storage.setItem(STORAGE_KEY, 'true')
        isLocked.value = false
        console.log('[Organizer Auth]', 'unlock SUCCESS: token stored, overlay unlocked')
        return { ok: true }
      }
      return { ok: false, error: 'Login succeeded but could not store token' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      console.error('[Organizer Auth]', 'unlock FAILED: organizer login did not succeed:', msg)
      return { ok: false, error: msg }
    }
  }

  /** Look up a submission by phone number. Returns the submission on success or an error string. */
  async function lookupByPhone(
    phone: string,
  ): Promise<{ ok: true; submission: SubmissionResponse } | { ok: false; error: string }> {
    try {
      const { submission } = await lookupSubmissionByPhone(phone)
      return { ok: true, submission }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No submission found for that phone number'
      return { ok: false, error: msg }
    }
  }

  return { isLocked, verifyPassword, unlock, lookupByPhone }
}
