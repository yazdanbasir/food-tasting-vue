<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLockOverlay } from '@/composables/useLockOverlay'
import { useSubmissionStore } from '@/stores/submission'
import '@/styles/form-section.css'

const router = useRouter()
const { isLocked, verifyPassword, unlock, lookupByPhone } = useLockOverlay()
const submissionStore = useSubmissionStore()

const input = ref('')
const error = ref<string | null>(null)
const isLookingUp = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

async function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  input.value = value
  error.value = null
  if (!value) return

  // Password match → unlock organizer immediately
  if (verifyPassword(value)) {
    input.value = ''
    const result = await unlock(value)
    if (!result.ok) error.value = result.error
    return
  }

  // Phone lookup → auto-trigger as soon as 10+ digits are entered
  const digitCount = value.replace(/\D/g, '').length
  if (digitCount >= 10) {
    await performLookup(value)
  }
}

async function performLookup(value: string) {
  if (isLookingUp.value) return
  isLookingUp.value = true
  error.value = null
  const result = await lookupByPhone(value)
  isLookingUp.value = false
  if (result.ok) {
    submissionStore.loadForEdit(result.submission, false)
    router.push('/')
  } else {
    error.value = result.error
  }
}

watch(isLocked, (locked) => {
  if (locked) {
    input.value = ''
    error.value = null
    requestAnimationFrame(() => inputRef.value?.focus({ preventScroll: true }))
  }
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    inputRef.value?.focus()
  }
}
</script>

<template>
  <div class="lock-container relative w-full h-full">
    <slot />

    <Teleport to="body">
      <Transition name="lock-fade">
        <div
          v-if="isLocked"
          class="lock-overlay fixed inset-0 z-[2147483647] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Unlock app"
          @keydown.tab.prevent="onKeydown"
        >
          <div class="flex flex-col items-center gap-4">

            <svg
              class="lock-icon lock-overlay-icon"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>

            <div v-if="error" class="lock-error">{{ error }}</div>
            <div v-else-if="isLookingUp" class="lock-searching">Searching...</div>

            <div class="lock-password-wrapper">
              <div
                class="lock-password-text-layer"
                :class="{ 'lock-password-text-layer-typing': input.length }"
              >
                <span
                  v-if="!input.length"
                  class="lock-password-placeholder"
                >Enter password or phone number</span>
                <span v-else class="lock-password-dots">{{ '•'.repeat(input.length) }}</span>
              </div>
              <input
                ref="inputRef"
                v-model="input"
                type="text"
                autocomplete="off"
                class="lock-password-input"
                @input="onInput"
              />
            </div>

            <div class="lock-back-block">
              <button type="button" class="btn-pill-primary lock-back-btn" aria-label="Take me back" @click="router.push('/')">
                <svg class="lock-back-arrow lock-overlay-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <span class="lock-back-caption">(I made a mistake. I shouldn't be here. Take me back!)</span>
            </div>

          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.lock-overlay-icon {
  flex-shrink: 0;
}

.lock-icon {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.6;
}

.lock-error {
  font-size: 0.9375rem;
  color: #b91c1c;
  text-align: center;
  max-width: 400px;
}

.lock-searching {
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.6;
}

.lock-overlay {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px) brightness(0.7);
  -webkit-backdrop-filter: blur(8px) brightness(0.7);
  pointer-events: auto;
}

.lock-password-wrapper {
  position: relative;
  display: inline-flex;
  min-height: 60px;
  min-width: 460px;
  width: max-content;
  padding: 0 24px;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.lock-password-text-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  pointer-events: none;
}

/* When typing, align dots to the left to match input/caret */
.lock-password-text-layer-typing {
  justify-content: flex-start;
}

.lock-password-placeholder,
.lock-password-dots {
  display: inline-block;
  white-space: nowrap;
  pointer-events: none;
}

.lock-password-placeholder {
  font-size: 1.5rem;
  color: rgba(60, 55, 60, 0.4);
}

.lock-password-dots {
  font-size: 2rem;
  letter-spacing: 0.15em;
  color: var(--color-lafayette-gray, #3c373c);
}

.lock-password-input {
  position: absolute;
  inset: 0;
  width: 100%;
  padding: 0 24px;
  border: none;
  border-radius: 12px;
  font-size: 2rem;
  letter-spacing: 0.15em;
  font-family: inherit;
  color: transparent;
  background: transparent;
  caret-color: var(--color-lafayette-gray, #3c373c);
  outline: none;
  box-shadow: none;
}

.lock-password-input:focus,
.lock-password-input:focus-visible {
  outline: none;
  box-shadow: none;
}

/* No focus ring on the bar (remove macOS/browser highlight and our red ring) */
.lock-password-wrapper:focus-within {
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-color: var(--color-lafayette-gray, #3c373c);
}

.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.3s ease-out;
}
.lock-fade-enter-from,
.lock-fade-leave-to {
  opacity: 0;
}

.lock-back-block {
  margin-top: 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.lock-back-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  min-width: 3rem;
  min-height: 3rem;
}

.lock-back-btn:focus,
.lock-back-btn:focus-visible {
  outline: none;
  box-shadow: none;
}

.lock-back-arrow {
  flex-shrink: 0;
}

.lock-back-caption {
  padding-top: 0.375rem;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.6;
  text-align: center;
  white-space: nowrap;
  line-height: 1.3;
}
</style>
