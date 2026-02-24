<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { organizerLogin } from '@/api/organizer'

const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref<string | null>(null)
const isLoading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) return

  isLoading.value = true
  error.value = null

  try {
    const result = await organizerLogin(username.value, password.value)
    localStorage.setItem('organizer_token', result.token)
    localStorage.setItem('organizer_username', result.username)
    router.push('/organizer')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-label">organizer login</div>

      <input
        v-model="username"
        type="text"
        placeholder="username"
        class="login-input"
        @keydown.enter="handleLogin"
      />
      <input
        v-model="password"
        type="password"
        placeholder="password"
        class="login-input"
        @keydown.enter="handleLogin"
      />

      <div v-if="error" class="login-error">{{ error }}</div>

      <button
        type="button"
        :disabled="isLoading || !username || !password"
        class="login-btn"
        :class="!isLoading && username && password ? 'login-btn-enabled' : 'login-btn-disabled'"
        @click="handleLogin"
      >
        {{ isLoading ? 'signing in...' : 'sign in' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  font-size: var(--body-font-size, 1.125rem);
}

.login-card {
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: var(--spacing-40, 2rem);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-30, 1.5rem);
  width: 100%;
  max-width: 24rem;
  box-shadow: var(--shadow-natural, 6px 6px 9px rgba(0, 0, 0, 0.2));
}

.login-label {
  font-size: 1rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.login-input {
  background: #fff;
  border-radius: 9999px;
  padding: calc(0.667em + 2px) 1rem;
  min-height: 2.5rem;
  outline: none;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  font-size: 1rem;
}

.login-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
}

.login-input:focus {
  border-color: var(--color-lafayette-dark-blue, #006690);
}

.login-error {
  font-size: 0.875rem;
  color: #b91c1c;
}

.login-btn {
  border-radius: 9999px;
  padding: calc(0.667em + 2px) calc(1.333em + 2px);
  min-height: 2.5rem;
  border: none;
  font-size: 1rem;
  transition: background-color 0.15s, opacity 0.15s;
}

.login-btn-enabled {
  background-color: var(--color-lafayette-red, #910029);
  color: #fff;
  cursor: pointer;
  opacity: 1;
}

.login-btn-enabled:hover {
  background-color: var(--color-lafayette-dark-blue, #006690);
}

.login-btn-enabled:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.login-btn-disabled {
  background-color: var(--color-lafayette-gray, #3c373c);
  color: #fff;
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
