<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'
import '@/styles/form-section.css'

const router = useRouter()
const store = useSubmissionStore()
const { lastSubmittedSubmission } = storeToRefs(store)

function handleImDone() {
  store.setLastSubmitted(null)
  store.reset()
  router.push('/')
}

function handleEditSubmission() {
  const sub = lastSubmittedSubmission.value
  if (!sub) return
  store.loadForEdit(sub)
  store.setLastSubmitted(null)
  router.push('/')
}
</script>

<template>
  <div class="confirmation-overlay">
    <div class="confirmation-inner">
      <svg
        class="confirmation-success-icon"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12l3 3 6-6" />
      </svg>
      <div class="confirmation-message-bar">
        <div class="confirmation-message-text">Thank you for your submission.</div>
      </div>

      <div class="confirmation-actions">
        <button
          v-if="lastSubmittedSubmission"
          type="button"
          class="btn-pill-secondary confirmation-btn"
          @click="handleEditSubmission"
        >
          Edit Form
        </button>
        <button type="button" class="btn-pill-primary confirmation-btn" @click="handleImDone">
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Match LockOverlay.vue: same overlay and inner layout (flex flex-col items-center gap-4) */
.confirmation-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px) brightness(0.7);
  -webkit-backdrop-filter: blur(8px) brightness(0.7);
  pointer-events: auto;
}

.confirmation-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

/* Same role as LockOverlay lock icon: above the box, same size; green for success */
.confirmation-success-icon {
  flex-shrink: 0;
  color: #16a34a;
  opacity: 0.9;
}

/* Same alignment/size as lock password bar; flat box (no shadow) so it reads as message, not input */
.confirmation-message-bar {
  position: relative;
  display: inline-flex;
  min-height: 60px;
  min-width: 460px;
  width: max-content;
  padding: 0 24px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  background: #fff;
  border-radius: 12px;
}

.confirmation-message-text {
  font-size: 1.5rem;
  color: #000;
  text-align: center;
  line-height: 1.3;
}

/* Match LockOverlay.vue .lock-back-block + .lock-back-btn: same button styling */
.confirmation-actions {
  margin-top: 0.25rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.confirmation-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.5rem;
  min-width: 3rem;
  min-height: 3rem;
}

.confirmation-btn:focus,
.confirmation-btn:focus-visible {
  outline: none;
  box-shadow: none;
}
</style>
