<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, nextTick } from 'vue'

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

const selectedLabel = computed(() => {
  if (!props.modelValue.length) return props.placeholder || 'Select'
  if (props.modelValue.length === 1) return props.modelValue[0]
  return `${props.modelValue.length} selected`
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
      :class="{ 'resource-select-btn--placeholder': !modelValue.length }"
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
        <button
          v-if="modelValue.length"
          type="button"
          class="resource-select-option resource-select-option--clear"
          @click.stop="clearAll"
        >
          ✕ Clear all
        </button>
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

.resource-select-chevron {
  flex-shrink: 0;
  font-size: 0.65em;
  opacity: 0.8;
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
