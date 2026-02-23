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
  <div class="h-full flex flex-col items-center justify-center gap-6 text-[17px]">
    <div class="bg-[#ececf1] rounded-2xl p-8 flex flex-col gap-4 w-full max-w-sm">
      <div class="text-sm text-gray-500">organizer login</div>

      <input
        v-model="username"
        type="text"
        placeholder="username"
        class="bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
        @keydown.enter="handleLogin"
      />
      <input
        v-model="password"
        type="password"
        placeholder="password"
        class="bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
        @keydown.enter="handleLogin"
      />

      <div v-if="error" class="text-xs text-red-500">{{ error }}</div>

      <button
        :disabled="isLoading || !username || !password"
        class="rounded-full px-4 py-1 min-h-8 bg-black text-white transition-opacity"
        :class="!isLoading && username && password ? 'opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
        @click="handleLogin"
      >
        {{ isLoading ? 'signing in...' : 'sign in' }}
      </button>
    </div>
  </div>
</template>
