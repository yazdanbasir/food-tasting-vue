<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const props = withDefaults(
  defineProps<{ showAddInput?: boolean }>(),
  { showAddInput: true },
)

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
  <div class="members-wrap">
    <input
      v-if="showAddInput"
      v-model="newMember"
      type="text"
      placeholder="add members..."
      class="members-input"
      @keydown.enter.prevent="addMember"
    />
    <div v-if="members.length" class="members-list">
      <div
        v-for="member in members"
        :key="member"
        class="members-item"
      >
        <span class="members-item-name truncate">{{ member }}</span>
        <button
          type="button"
          class="members-item-remove"
          aria-label="Remove member"
          @click="store.removeMember(member)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.members-wrap {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  width: 100%;
}

.members-input {
  width: 100%;
  flex: none;
  background: #fff;
  border-radius: 9999px;
  padding: 0.25rem 1rem;
  min-height: 2rem;
  outline: none;
  border: none;
  font-size: inherit;
}

.members-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}

.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  min-height: 0;
}

.members-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff;
  border-radius: 9999px;
  padding: 0.25rem 0.5rem 0.25rem 1rem;
  min-height: 2rem;
  width: 100%;
  max-width: 28rem;
}

.members-item-name {
  flex: 1;
  min-width: 0;
  font-size: inherit;
}

.members-item-remove {
  flex: none;
  padding: 0 0.25rem;
  background: none;
  border: none;
  color: var(--color-lafayette-gray, #3c373c);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s;
}

.members-item-remove:hover {
  color: #000;
}
</style>
