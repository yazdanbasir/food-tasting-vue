<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const { dishName } = storeToRefs(useSubmissionStore())
</script>

<template>
  <input
    v-model="dishName"
    type="text"
    placeholder="dish name..."
    class="dish-name-input"
  />
</template>

<style scoped>
.dish-name-input {
  width: 100%;
  background: #fff;
  border-radius: 9999px;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  outline: none;
  border: none;
  font-size: inherit;
  font-family: inherit;
}

.dish-name-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}
</style>
