<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: 'hot' | 'cold' | ''
  placeholder: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: 'hot' | 'cold'): void
}>()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const options = [{ value: 'hot' as const, label: 'Hot' }, { value: 'cold' as const, label: 'Cold' }]

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => {
      if (buttonRef.value) {
        const rect = buttonRef.value.getBoundingClientRect()
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))
        dropdownStyle.value = {
          position: 'fixed',
          top: `${rect.bottom + 4}px`,
          left: `${left}px`,
          width: `${rect.width}px`,
          minWidth: `${rect.width}px`,
        }
      }
    })
  }
}

function select(value: 'hot' | 'cold') {
  emit('update:modelValue', value)
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  // Defer so option click/mousedown can run first and set open = false
  setTimeout(() => {
    if (
      open.value &&
      dropdownRef.value &&
      !dropdownRef.value.contains(target) &&
      buttonRef.value &&
      !buttonRef.value.contains(target)
    ) {
      open.value = false
    }
  }, 0)
}

onMounted(() => { document.addEventListener('click', handleClickOutside) })
onUnmounted(() => { document.removeEventListener('click', handleClickOutside) })
</script>

<template>
  <div class="yes-no-select-wrap">
    <button
      ref="buttonRef"
      type="button"
      class="yes-no-select-btn"
      :class="{ 'yes-no-select-btn--placeholder': !modelValue }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <template v-if="modelValue">
        <span class="yes-no-question-label">{{ placeholder }}</span>
        <span class="yes-no-answer-label">{{ modelValue === 'hot' ? 'Hot' : 'Cold' }}</span>
      </template>
      <template v-else>{{ placeholder }}</template>
      <span class="yes-no-select-chevron" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
    </button>
    <Teleport to="body">
      <div
        v-show="open"
        ref="dropdownRef"
        class="yes-no-select-dropdown hot-cold-select-dropdown"
        :style="dropdownStyle"
        role="listbox"
        tabindex="-1"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          role="option"
          class="yes-no-select-option"
          :aria-selected="modelValue === option.value"
          @mousedown.stop="select(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.yes-no-select-wrap {
  position: relative;
  display: inline-block;
  width: 100%;
  min-width: 0;
}

.yes-no-select-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;
}

.yes-no-select-btn--placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}

.yes-no-select-btn:hover {
  opacity: 0.85;
}

.yes-no-question-label {
  opacity: 0.55;
  font-weight: 400;
  margin-right: 0.3em;
}

.yes-no-answer-label {
  font-weight: 700;
  margin-right: 0.15em;
}

.yes-no-select-chevron {
  flex-shrink: 0;
  font-size: 0.65em;
  opacity: 0.8;
}
</style>

<style>
.hot-cold-select-dropdown {
  z-index: 10001;
}
</style>
