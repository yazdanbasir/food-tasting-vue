<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getFormLockStatus, setFormLockStatus } from '@/api/organizer'

const route = useRoute()
const isOrganizerRoute = computed(() => route.path === '/organizer' && route.query.mode !== 'student-edit')
const formLockPopoverOpen = ref(false)
const formLockPopoverRef = ref<HTMLElement | null>(null)
const formLockButtonRef = ref<HTMLElement | null>(null)
const formLockDropdownRef = ref<HTMLElement | null>(null)
const formLockDropdownStyle = ref<Record<string, string>>({})
const isUpdatingFormLock = ref(false)
const submissionsLocked = ref(false)
const formLockError = ref<string | null>(null)

async function loadFormLockState() {
  if (!isOrganizerRoute.value) return
  try {
    const data = await getFormLockStatus()
    submissionsLocked.value = Boolean(data.submissions_locked)
    formLockError.value = null
  } catch (err) {
    formLockError.value = err instanceof Error ? err.message : 'Could not load form lock status'
  }
}

async function toggleFormLockPopover() {
  formLockPopoverOpen.value = !formLockPopoverOpen.value
  if (!formLockPopoverOpen.value) return
  await loadFormLockState()
  await nextTick()
  const rect = formLockButtonRef.value?.getBoundingClientRect()
  if (!rect) return
  formLockDropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
  }
}

async function handleFormLockToggle(nextLocked: boolean) {
  if (isUpdatingFormLock.value) return
  const prev = submissionsLocked.value
  submissionsLocked.value = nextLocked
  isUpdatingFormLock.value = true
  formLockError.value = null
  try {
    const data = await setFormLockStatus(nextLocked)
    submissionsLocked.value = Boolean(data.submissions_locked)
  } catch (err) {
    submissionsLocked.value = prev
    formLockError.value = err instanceof Error ? err.message : 'Could not update lock status'
  } finally {
    isUpdatingFormLock.value = false
  }
}

function handleFormLockClickOutside(e: MouseEvent) {
  if (!formLockPopoverOpen.value) return
  const target = e.target as Node
  if (formLockPopoverRef.value?.contains(target)) return
  if (formLockDropdownRef.value?.contains(target)) return
  formLockPopoverOpen.value = false
}

watch(isOrganizerRoute, (isOrganizer) => {
  formLockPopoverOpen.value = false
  if (isOrganizer) void loadFormLockState()
}, { immediate: true })

watch(formLockPopoverOpen, (open) => {
  if (open) {
    nextTick(() => document.addEventListener('click', handleFormLockClickOutside))
  } else {
    document.removeEventListener('click', handleFormLockClickOutside)
  }
})

onUnmounted(() => document.removeEventListener('click', handleFormLockClickOutside))
</script>

<template>
  <header class="app-header">
    <div class="app-header-spacer" aria-hidden="true"></div>
    <!-- Center: ISA logo + event name -->
    <div class="app-header-center">
      <img src="/isa-logo.png" alt="ISA" class="app-header-isa" />
      <span class="app-header-event">ISA Food Tasting</span>
    </div>

    <!-- Right: nav links -->
    <div class="app-header-right">
      <RouterLink
        to="/"
        class="app-header-link"
        :class="route.path === '/' ? 'app-header-link-active' : 'app-header-link-inactive'"
      >
        Form
      </RouterLink>
      <div
        v-if="isOrganizerRoute"
        ref="formLockPopoverRef"
        class="app-header-lock-wrap"
      >
        <button
          ref="formLockButtonRef"
          type="button"
          class="app-header-link app-header-link-inactive app-header-lock-trigger"
          :aria-expanded="formLockPopoverOpen"
          aria-haspopup="dialog"
          :title="submissionsLocked ? 'Responses locked' : 'Responses open'"
          @click.stop="toggleFormLockPopover"
        >
          <svg
            class="app-header-lock-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
        <Teleport to="body">
          <div
            v-if="formLockPopoverOpen"
            ref="formLockDropdownRef"
            class="resource-select-dropdown app-header-lock-popover"
            :style="formLockDropdownStyle"
            role="dialog"
            aria-label="Form lock controls"
          >
            <div class="app-header-lock-row">
              <span class="app-header-lock-label">{{ submissionsLocked ? 'Responses Locked' : 'Responses Unlocked' }}</span>
              <button
                type="button"
                class="app-header-lock-switch"
                :class="submissionsLocked ? 'app-header-lock-switch-on' : 'app-header-lock-switch-off'"
                :disabled="isUpdatingFormLock"
                :aria-pressed="submissionsLocked"
                :aria-label="submissionsLocked ? 'Responses Locked' : 'Responses Unlocked'"
                @click.stop="handleFormLockToggle(!submissionsLocked)"
              >
                <span class="app-header-lock-switch-thumb" />
              </button>
            </div>
            <div v-if="formLockError" class="app-header-lock-error">{{ formLockError }}</div>
          </div>
        </Teleport>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  min-height: 3.75rem;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  gap: 1rem;
  background-color: var(--color-lafayette-red, #6b0f2a);
  border-radius: 1rem;
  overflow: visible;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.app-header-spacer {
  flex: 1;
  min-width: 0;
}

.app-header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  gap: 1.25rem;
}

.app-header-isa {
  height: 2.25rem;
  object-fit: contain;
}

.app-header-event {
  font-size: 1.75rem;
  color: #fff;
  font-weight: 500;
}

.app-header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
  justify-content: flex-end;
}

.app-header-link {
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s;
  text-decoration: none;
  flex: none;
}

.app-header-link-active {
  background-color: #fff;
  color: var(--color-lafayette-red, #6b0f2a);
}

.app-header-link-active:hover {
  background-color: #fff;
  color: var(--color-lafayette-red, #6b0f2a);
}

.app-header-link-active:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.app-header-link-inactive {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.92);
}

.app-header-link-inactive:hover {
  background-color: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.app-header-link-inactive:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.app-header-lock-wrap {
  position: relative;
}

.app-header-lock-trigger {
  gap: 0.4rem;
}

.app-header-lock-icon {
  opacity: 0.85;
}

.app-header-lock-popover {
  padding: 0.25rem 0;
}

.app-header-lock-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
}

.app-header-lock-label {
  font: inherit;
  font-weight: 400;
  color: #000 !important;
  white-space: nowrap;
}

.app-header-lock-switch {
  width: 3rem;
  height: 1.65rem;
  border-radius: 9999px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  padding: 0.1rem;
  display: inline-flex;
  align-items: center;
  transition: background-color 0.15s ease;
}

.app-header-lock-switch-on {
  background: var(--color-lafayette-red, #6b0f2a);
}

.app-header-lock-switch-off {
  background: rgba(0, 0, 0, 0.2);
}

.app-header-lock-switch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.app-header-lock-switch-thumb {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 9999px;
  background: #fff;
  transform: translateX(0);
  transition: transform 0.15s ease;
}

.app-header-lock-switch-on .app-header-lock-switch-thumb {
  transform: translateX(1.25rem);
}

.app-header-lock-error {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #b91c1c;
}

/* ── Mobile: stack title row + nav row ── */
@media (max-width: 600px) {
  .app-header {
    flex-wrap: wrap;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    gap: 0.4rem;
  }

  .app-header-spacer {
    display: none;
  }

  .app-header-center {
    width: 100%;
    justify-content: center;
    gap: 0.75rem;
  }

  .app-header-event {
    font-size: 1.4rem;
  }

  .app-header-isa {
    height: 1.85rem;
  }

  .app-header-right {
    width: 100%;
    justify-content: center;
    flex: none;
  }

  .app-header-link {
    font-size: 1.1rem;
    padding: 0.4rem 1.25rem;
    min-height: 2.25rem;
  }
}
</style>
