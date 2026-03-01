<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string[]
  options: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
}>()

const open = ref(false)
const buttonRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})


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

function toggleOption(name: string) {
  if (props.modelValue.includes(name)) {
    emit('update:modelValue', props.modelValue.filter((n) => n !== name))
  } else {
    emit('update:modelValue', [...props.modelValue, name])
  }
}

function clearAll() {
  emit('update:modelValue', [])
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
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <span class="resource-select-labels">
        <span v-if="!modelValue.length" class="resource-select-placeholder">{{ placeholder || 'Select' }}</span>
        <span v-for="item in modelValue" :key="item" class="resource-select-label-item">{{ item }}</span>
      </span>
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
            class="resource-select-option resource-select-option--multi"
            :aria-selected="modelValue.includes(name)"
            :class="{ 'resource-select-option--selected': modelValue.includes(name) }"
            @click.stop="toggleOption(name)"
          >
            <span class="resource-select-check">{{ modelValue.includes(name) ? '✓' : '' }}</span>
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
  display: block;
  width: 100%;
  min-width: 0;
}

.resource-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  padding: 0.25rem 1.25rem;
  min-height: 2.75rem;
  width: 100%;
  border: none;
  /* Match parent pill: fixed 1.5rem so multi-line keeps same curvature as single-line (stays pill, not rounder) */
  border-radius: 1.5rem;
  background: transparent;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  outline: none;
}

.resource-select-labels {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  line-height: 1.4;
}

.resource-select-placeholder {
  color: #3c373c;
  opacity: 0.7;
}

.resource-select-label-item {
  display: block;
  color: #000;
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
  align-self: center;
}
</style>

<style>
.resource-select-option--multi {
  display: flex !important;
  align-items: center;
  gap: 0.5rem;
  text-align: left !important;
}

.resource-select-check {
  width: 1em;
  flex-shrink: 0;
  color: #6b0f2a;
  font-weight: 700;
}
</style>
