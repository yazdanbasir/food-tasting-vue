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
      <div class="text-center">
        <div class="confirmation-label">Thank you for your submission.</div>
      </div>

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
.confirmation-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-60, 3rem);
  margin: 0 1.5rem;
  font-size: var(--body-font-size, 1.125rem);
}

.confirmation-card {
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: var(--spacing-50, 2.5rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  max-width: 28rem;
  width: 100%;
  box-shadow: var(--shadow-natural, 6px 6px 9px rgba(0, 0, 0, 0.2));
}

.confirmation-label {
  font-size: 1.125rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.confirmation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.confirmation-btn {
  border-radius: 9999px;
  padding: calc(0.667em + 2px) calc(1.333em + 2px);
  min-height: 2.5rem;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.confirmation-btn-primary {
  background-color: var(--color-lafayette-red, #910029);
  color: #fff;
}

.confirmation-btn-primary:hover {
  background-color: var(--color-lafayette-dark-blue, #006690);
}

.confirmation-btn-secondary {
  background-color: var(--color-lafayette-gray, #3c373c);
  color: #fff;
}

.confirmation-btn-secondary:hover {
  background-color: #2a262a;
}

.confirmation-btn:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}
</style>
