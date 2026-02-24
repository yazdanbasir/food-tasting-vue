<script setup lang="ts">
import { ref, watch } from 'vue'
import { useLockOverlay } from '@/composables/useLockOverlay'

const { isLocked, verifyPassword, unlock } = useLockOverlay()

const password = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function onPasswordInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  password.value = value
  if (!value) return
  if (verifyPassword(value)) {
    password.value = ''
    unlock()
  }
}

watch(isLocked, (locked) => {
  if (locked) {
    password.value = ''
    requestAnimationFrame(() => {
      inputRef.value?.focus({ preventScroll: true })
    })
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
              class="w-6 h-6 lock-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div class="lock-password-wrapper">
              <span v-if="!password.length" class="lock-password-placeholder">Enter password</span>
              <span v-else class="lock-password-dots">{{ '•'.repeat(password.length) }}</span>
              <input
                ref="inputRef"
                v-model="password"
                type="text"
                autocomplete="off"
                class="lock-password-input"
                @input="onPasswordInput"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.lock-icon {
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
  width: 280px;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.lock-password-placeholder {
  position: absolute;
  font-size: 1.25rem;
  color: rgba(60, 55, 60, 0.4);
  pointer-events: none;
}

.lock-password-dots {
  position: absolute;
  font-size: 1.75rem;
  letter-spacing: 0.15em;
  color: var(--color-lafayette-gray, #3c373c);
  pointer-events: none;
}

.lock-password-input {
  position: absolute;
  inset: 0;
  width: 100%;
  padding: 0 16px;
  border: none;
  border-radius: 10px;
  font-size: 1.75rem;
  letter-spacing: 0.15em;
  font-family: inherit;
  color: transparent;
  background: transparent;
  caret-color: var(--color-lafayette-gray, #3c373c);
  outline: none;
}

.lock-password-input:focus {
  box-shadow: none;
}

.lock-password-wrapper:focus-within {
  border-color: var(--color-lafayette-red, #910029);
  box-shadow: 0 0 0 3px rgba(145, 0, 41, 0.12);
}

.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.3s ease-out;
}
.lock-fade-enter-from,
.lock-fade-leave-to {
  opacity: 0;
}
</style>
