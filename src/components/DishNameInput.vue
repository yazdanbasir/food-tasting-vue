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
    class="w-full bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
  />
</template>
