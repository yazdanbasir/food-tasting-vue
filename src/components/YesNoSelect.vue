<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  modelValue: 'yes' | 'no' | ''
  placeholder: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: 'yes' | 'no'): void
}>()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)

function toggle() {
  open.value = !open.value
}

function select(value: 'yes' | 'no') {
  emit('update:modelValue', value)
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (
    open.value &&
    dropdownRef.value &&
    !dropdownRef.value.contains(target) &&
    buttonRef.value &&
    !buttonRef.value.contains(target)
  ) {
    open.value = false
  }
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
        <span class="yes-no-answer-label">{{ modelValue === 'yes' ? 'Yes' : 'No' }}</span>
      </template>
      <template v-else>{{ placeholder }}</template>
      <span class="yes-no-select-chevron" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
    </button>
    <div
      v-show="open"
      ref="dropdownRef"
      class="yes-no-select-dropdown"
      role="listbox"
      tabindex="-1"
    >
      <button
        v-for="option in [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]"
        :key="option.value"
        type="button"
        role="option"
        class="yes-no-select-option"
        :aria-selected="modelValue === option.value"
        @click="select(option.value as 'yes' | 'no')"
      >
        {{ option.label }}
      </button>
    </div>
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

.yes-no-select-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  min-width: 100%;
  background: #fff;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  padding: 0.25rem 0;
  outline: none;
}

.yes-no-select-option {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.1s;
  white-space: nowrap;
}

.yes-no-select-option:hover {
  background-color: rgba(145, 0, 41, 0.08);
}

.yes-no-select-option[aria-selected="true"] {
  background-color: rgba(145, 0, 41, 0.12);
  font-weight: 500;
}
</style>
