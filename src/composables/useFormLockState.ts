import { ref } from 'vue'
import { getFormLockStatus } from '@/api/organizer'

const isResponsesLocked = ref(false)
const hasLoadedFormLock = ref(false)
const isRefreshingFormLock = ref(false)

export function useFormLockState() {
  async function refreshFormLockStatus(): Promise<boolean> {
    if (isRefreshingFormLock.value) return isResponsesLocked.value
    isRefreshingFormLock.value = true
    try {
      const data = await getFormLockStatus()
      isResponsesLocked.value = Boolean(data.submissions_locked)
      hasLoadedFormLock.value = true
      return isResponsesLocked.value
    } catch {
      return isResponsesLocked.value
    } finally {
      isRefreshingFormLock.value = false
    }
  }

  return {
    isResponsesLocked,
    hasLoadedFormLock,
    isRefreshingFormLock,
    refreshFormLockStatus,
  }
}
