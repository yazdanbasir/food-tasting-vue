<!-- Thin string wrapper around PillSelect for hot/cold selection -->
<script setup lang="ts">
import PillSelect from '@/components/PillSelect.vue'

defineProps<{
  modelValue: 'hot' | 'cold' | ''
  placeholder: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: 'hot' | 'cold'): void
}>()

const options = [
  { value: 'hot' as const, label: 'Hot' },
  { value: 'cold' as const, label: 'Cold' },
]
</script>

<template>
  <PillSelect
    :model-value="modelValue || null"
    :placeholder="placeholder"
    :options="options"
    dropdown-class="hot-cold-select-dropdown"
    @update:model-value="$emit('update:modelValue', $event as 'hot' | 'cold')"
  />
</template>

<style>
.hot-cold-select-dropdown {
  z-index: 10001;
}
</style>
