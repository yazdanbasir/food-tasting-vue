import { ref } from 'vue'
import { organizerLogin } from '@/api/organizer'

const STORAGE_KEY = 'organizer_unlocked'
const CORRECT_PASSWORD = 'disney1994'

const isLocked = ref(sessionStorage.getItem(STORAGE_KEY) !== 'true')

export function useLockOverlay() {
  function verifyPassword(pwd: string): boolean {
    return pwd === CORRECT_PASSWORD
  }

  /** Unlock the overlay. If env has API credentials, fetches an organizer token so updates work. */
  async function unlock() {
    const apiUser = import.meta.env.VITE_ORGANIZER_API_USERNAME as string | undefined
    const apiPass = import.meta.env.VITE_ORGANIZER_API_PASSWORD as string | undefined
    if (apiUser && apiPass) {
      try {
        const result = await organizerLogin(apiUser, apiPass)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('organizer_token', result.token)
          localStorage.setItem('organizer_username', result.username)
        }
      } catch {
        // Continue to unlock so they can view; updates will fail until they have a token
      }
    }
    sessionStorage.setItem(STORAGE_KEY, 'true')
    isLocked.value = false
  }

  return { isLocked, verifyPassword, unlock }
}
