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
  <div class="flex flex-col gap-3">
    <input
      v-model="newMember"
      type="text"
      placeholder="add a member, press enter..."
      class="bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
      @keydown.enter.prevent="addMember"
    />
    <div v-if="members.length" class="flex flex-wrap gap-2">
      <span
        v-for="member in members"
        :key="member"
        class="flex items-center gap-1.5 bg-white rounded-full pl-3 pr-2 py-1 min-h-8"
      >
        {{ member }}
        <button
          class="text-gray-400 hover:text-gray-700 leading-none transition-colors"
          @click="store.removeMember(member)"
        >×</button>
      </span>
    </div>
  </div>
</template>
