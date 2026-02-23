<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const store = useSubmissionStore()
const { members } = storeToRefs(store)

const newMember = ref('')

function addMember() {
  const name = newMember.value.trim()
  if (name) {
    store.addMember(name)
    newMember.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 min-h-0">
    <!-- Row aligned with pill + 1rem: spacer then input (same as app bar styling) -->
    <div class="flex items-center flex-none">
      <div class="min-w-[11rem] flex-none" />
      <input
        v-model="newMember"
        type="text"
        placeholder="add a member, press enter..."
        class="flex-1 bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
        @keydown.enter.prevent="addMember"
      />
    </div>
    <!-- Members list: aligned with input bar, same styling as app (rounded-full, bg-white, min-h-8) -->
    <div
      v-if="members.length"
      class="flex flex-col gap-2 overflow-y-auto min-h-0 pl-[11rem]"
    >
      <div
        v-for="member in members"
        :key="member"
        class="flex items-center gap-2 bg-white rounded-full pl-4 pr-2 py-1 min-h-8 w-full max-w-md"
      >
        <span class="flex-1 min-w-0 truncate text-[15px]">{{ member }}</span>
        <button
          class="text-gray-400 hover:text-gray-700 leading-none transition-colors flex-none"
          @click="store.removeMember(member)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>
