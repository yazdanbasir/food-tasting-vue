import { ref } from 'vue'
import { organizerLogin } from '@/api/organizer'

const STORAGE_KEY = 'organizer_unlocked'
const CORRECT_PASSWORD = 'disney1994'
const LOG_PREFIX = '[Organizer Auth]'

const isLocked = ref(localStorage.getItem(STORAGE_KEY) !== 'true')

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
    console.log(LOG_PREFIX, 'unlock: attempting organizer login', { username, hasApiPass: !!apiPass })
    try {
      const result = await organizerLogin(username, pass)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('organizer_token', result.token)
        localStorage.setItem('organizer_username', result.username)
        localStorage.setItem(STORAGE_KEY, 'true')
        isLocked.value = false
        console.log(LOG_PREFIX, 'unlock SUCCESS: token stored, overlay unlocked')
        return { ok: true }
      }
      return { ok: false, error: 'Login succeeded but could not store token' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      console.error(LOG_PREFIX, 'unlock FAILED: organizer login did not succeed:', msg)
      return { ok: false, error: msg }
    }
  }

  return { isLocked, verifyPassword, unlock }
}
