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
    <span
      v-for="{ key, label, icon } in activeFlags"
      :key="key"
      class="dietary-icon-wrap"
      :title="label"
      :aria-label="label"
    >
      <component
        :is="icon"
        :size="size"
        class="dietary-icon"
        aria-hidden="true"
      />
    </span>
  </span>
</template>

<style scoped>
.dietary-icons {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.dietary-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 1.25rem;
  min-height: 1.25rem;
}

.dietary-icon {
  flex-shrink: 0;
  color: var(--color-lafayette-gray, #3c373c);
  pointer-events: none;
}
</style>
