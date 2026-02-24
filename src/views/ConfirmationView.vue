<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const accessCode = route.params.accessCode as string
</script>

<template>
  <div class="confirmation-page">
    <div class="confirmation-card">
      <div class="text-center">
        <div class="confirmation-label">submission received</div>
        <div class="confirmation-code">{{ accessCode }}</div>
      </div>

      <p class="confirmation-message">
        Save this code. You'll need it to look up or edit your submission later.
      </p>

      <button type="button" class="confirmation-btn" @click="router.push('/')">
        submit another
      </button>
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
  font-size: 1rem;
  color: var(--color-lafayette-gray, #3c373c);
  margin-bottom: 0.5rem;
}

.confirmation-code {
  font-size: clamp(1.75rem, 4vw, 1.875rem);
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #000;
}

.confirmation-message {
  font-size: 1rem;
  color: var(--color-lafayette-gray, #3c373c);
  text-align: center;
  line-height: 1.6;
}

.confirmation-btn {
  border-radius: 9999px;
  padding: calc(0.667em + 2px) calc(1.333em + 2px);
  min-height: 2.5rem;
  background-color: var(--color-lafayette-red, #910029);
  color: #fff;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.confirmation-btn:hover {
  background-color: var(--color-lafayette-dark-blue, #006690);
}

.confirmation-btn:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}
</style>
