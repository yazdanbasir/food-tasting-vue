<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string | null
  options: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const v = props.modelValue?.trim()
  if (v) return v
  return props.placeholder || 'Select'
})

function toggle() {
  open.value = !open.value
}

function selectOption(name: string) {
  emit('update:modelValue', name)
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

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="resource-select-wrap">
    <button
      ref="buttonRef"
      type="button"
      class="resource-select-btn"
      :class="{ 'resource-select-btn--placeholder': !modelValue }"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      {{ selectedLabel }}
      <span class="resource-select-chevron" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
    </button>
    <div
      v-show="open"
      ref="dropdownRef"
      class="resource-select-dropdown"
      role="listbox"
      tabindex="-1"
    >
      <template v-if="options.length">
        <button
          v-for="name in options"
          :key="name"
          type="button"
          role="option"
          class="resource-select-option"
          :aria-selected="modelValue === name"
          @click="selectOption(name)"
        >
          {{ name }}
        </button>
      </template>
      <div v-else class="resource-select-empty">
        No options available
      </div>
    </div>
  </div>
</template>

<style scoped>
.resource-select-wrap {
  position: relative;
  display: inline-block;
  width: max-content;
  min-width: 0;
}

/* IDENTICAL to .country-select-btn from CountrySelect.vue */
.resource-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: #3c373c !important;
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

.resource-select-btn--placeholder {
  color: #3c373c !important;
  opacity: 0.7;
}

.resource-select-btn:hover:not([disabled]) {
  opacity: 0.85;
}

.resource-select-btn:focus-visible {
  outline: none;
}

/* IDENTICAL to .country-select-chevron */
.resource-select-chevron {
  flex-shrink: 0;
  font-size: 0.65em;
  opacity: 0.8;
}

/* IDENTICAL to .country-select-dropdown */
.resource-select-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  min-width: 18rem;
  width: max-content;
  max-width: min(22rem, 95vw);
  max-height: 36rem;
  overflow-y: auto;
  background: #fff;
  color: #000;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  padding: 0.25rem 0;
  outline: none;
}

/* IDENTICAL to .country-select-option */
.resource-select-option {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  color: #000 !important;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resource-select-option:hover {
  background-color: rgba(145, 0, 41, 0.08);
}

.resource-select-option[aria-selected="true"] {
  background-color: rgba(145, 0, 41, 0.12);
  font-weight: 500;
}

.resource-select-empty {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #000;
  opacity: 0.7;
}
</style>

