<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string | null
  options: string[]
  placeholder?: string
  clearable?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = ref(false)
const buttonRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => {
  const v = props.modelValue?.trim()
  if (v) return v
  return props.placeholder || 'Select'
})

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    if (buttonRef.value) {
      const rect = buttonRef.value.getBoundingClientRect()
      dropdownStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
      }
    }
  }
}

function selectOption(name: string) {
  if (props.modelValue === name) {
    emit('update:modelValue', '')
  } else {
    emit('update:modelValue', name)
  }
  open.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (open.value && buttonRef.value && !buttonRef.value.contains(e.target as Node)) {
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
      @click.stop="toggle"
    >
      {{ selectedLabel }}
      <span class="resource-select-chevron" aria-hidden="true">{{ open ? '▲' : '▼' }}</span>
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        class="resource-select-dropdown"
        :style="dropdownStyle"
        role="listbox"
        tabindex="-1"
      >
        <template v-if="options.length">
          <button
            v-for="name in options"
            :key="name"
            type="button"
            role="option"
            class="resource-select-option resource-select-option--single"
            :aria-selected="modelValue === name"
            :class="{ 'resource-select-option--selected': modelValue === name }"
            @click.stop="selectOption(name)"
          >
            <span class="resource-select-check">{{ modelValue === name ? '✓' : '' }}</span>
            {{ name }}
          </button>
        </template>
        <div v-else class="resource-select-empty">
          No options available
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.resource-select-wrap {
  position: relative;
  display: inline-block;
  width: max-content;
  min-width: 0;
}

.resource-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.25rem 1rem;
  min-height: 2.75rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
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

.resource-select-btn:not(.resource-select-btn--placeholder) {
  color: #000;
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

.resource-select-chevron {
  flex-shrink: 0;
  font-size: 0.65em;
  opacity: 0.8;
}
</style>

<style>
.resource-select-dropdown {
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
  z-index: 9999;
  padding: 0.25rem 0;
  outline: none;
}

.resource-select-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  background-color: rgba(107, 15, 42, 0.08);
}

.resource-select-option[aria-selected="true"] {
  background-color: rgba(107, 15, 42, 0.12);
  font-weight: 500;
}

.resource-select-option--clear {
  color: #b91c1c !important;
  font-size: 0.8rem;
  padding: 0.25rem 1rem;
  opacity: 0.75;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  margin-bottom: 0.125rem;
}

.resource-select-check {
  width: 1em;
  flex-shrink: 0;
  color: #6b0f2a;
  font-weight: 700;
}

.resource-select-empty {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #000;
  opacity: 0.7;
}
</style>