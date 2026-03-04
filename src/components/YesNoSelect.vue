<!-- Thin boolean wrapper around PillSelect: Yes → true, No → false -->
<script setup lang="ts">
import PillSelect from '@/components/PillSelect.vue'

defineProps<{
  modelValue: boolean | null
  placeholder: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const options = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
]
</script>

<template>
  <PillSelect
    :model-value="modelValue"
    :placeholder="placeholder"
    :options="options"
    @update:model-value="$emit('update:modelValue', $event)"
  />
</template>
