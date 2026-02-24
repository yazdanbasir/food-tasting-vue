import { ref } from 'vue'

const STORAGE_KEY = 'organizer_unlocked'
const CORRECT_PASSWORD = 'disney1994'

const isLocked = ref(sessionStorage.getItem(STORAGE_KEY) !== 'true')

export function useLockOverlay() {
  function verifyPassword(pwd: string): boolean {
    return pwd === CORRECT_PASSWORD
  }

  function unlock() {
    sessionStorage.setItem(STORAGE_KEY, 'true')
    isLocked.value = false
  }

  return { isLocked, verifyPassword, unlock }
}
