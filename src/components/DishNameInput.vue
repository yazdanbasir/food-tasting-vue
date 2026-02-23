<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const { teamName, dishName } = storeToRefs(useSubmissionStore())
</script>

<template>
  <div class="flex flex-col gap-2 flex-1 justify-center">
    <div class="flex items-center gap-4">
      <div class="min-w-[5.5rem] flex-none" />
      <input
        v-model="teamName"
        type="text"
        placeholder="team name..."
        class="flex-1 bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
      />
    </div>
    <div class="flex items-center gap-4">
      <div class="min-w-[5.5rem] flex-none" />
      <input
        v-model="dishName"
        type="text"
        placeholder="dish name..."
        class="flex-1 bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
      />
    </div>
  </div>
</template>
