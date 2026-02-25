<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

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
  <div class="confirmation-page">
    <div class="confirmation-card">
      <div class="confirmation-label">Thank you for your submission.</div>
      <div class="confirmation-actions">
        <button type="button" class="confirmation-btn confirmation-btn-primary" @click="handleImDone">
          I'm Done
        </button>
        <button
          v-if="lastSubmittedSubmission"
          type="button"
          class="confirmation-btn confirmation-btn-secondary"
          @click="handleEditSubmission"
        >
          Edit Submission
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Match lock overlay: blurred backdrop and centered content */
.confirmation-page {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 1.5rem;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px) brightness(0.97);
  -webkit-backdrop-filter: blur(8px) brightness(0.97);
}

/* Match lock overlay card: white, border, radius, shadow */
.confirmation-card {
  background: #fff;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  max-width: 28rem;
  width: 100%;
}

.confirmation-label {
  font-size: 1.25rem;
  color: var(--color-lafayette-gray, #3c373c);
  text-align: center;
}

/* Buttons side by side; match header nav pill style */
.confirmation-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
}

/* Reuse header nav button look: pill, same padding/size/transition */
.confirmation-btn {
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  min-height: 2.75rem;
  font-size: 1.25rem;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
  cursor: pointer;
  flex: none;
}

/* Primary = header bar color: red fill, white text */
.confirmation-btn-primary {
  background-color: var(--color-lafayette-red, #910029);
  color: #fff;
  border: none;
}

.confirmation-btn-primary:hover {
  background-color: var(--color-lafayette-dark-blue, #006690);
  color: #fff;
}

.confirmation-btn-primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(145, 0, 41, 0.12);
}

/* Secondary = inactive-style on light card: transparent, red border/text */
.confirmation-btn-secondary {
  background-color: transparent;
  color: var(--color-lafayette-red, #910029);
  border: 2px solid var(--color-lafayette-red, #910029);
}

.confirmation-btn-secondary:hover {
  background-color: rgba(145, 0, 41, 0.08);
  color: var(--color-lafayette-red, #910029);
}

.confirmation-btn-secondary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(145, 0, 41, 0.12);
}
</style>
