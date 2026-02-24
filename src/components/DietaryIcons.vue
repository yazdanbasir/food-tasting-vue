<script setup lang="ts">
import { computed } from 'vue'
import { DIETARY_FLAGS } from '@/data/dietaryFlags'
import type { IngredientDietary } from '@/types/ingredient'

const props = withDefaults(
  defineProps<{
    dietary: IngredientDietary
    size?: number
    class?: string
  }>(),
  { size: 18, class: '' }
)

const activeFlags = computed(() =>
  DIETARY_FLAGS.filter(({ key }) => props.dietary[key])
)
</script>

<template>
  <span v-if="activeFlags.length" class="dietary-icons" :class="props.class">
    <component
      v-for="{ key, label, icon } in activeFlags"
      :key="key"
      :is="icon"
      :size="size"
      :aria-label="label"
      :title="label"
      class="dietary-icon"
    />
  </span>
</template>

<style scoped>
.dietary-icons {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.dietary-icon {
  flex-shrink: 0;
  color: var(--color-lafayette-gray, #3c373c);
}
</style>
