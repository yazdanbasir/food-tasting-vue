<script setup lang="ts">
import type { Ingredient } from '@/types/ingredient'

defineProps<{
  ingredient: Ingredient
}>()
</script>

<template>
  <img
    v-if="ingredient.image_url"
    :src="ingredient.image_url"
    :alt="ingredient.name"
    class="ingredient-thumb"
  />
  <div v-else class="ingredient-thumb ingredient-thumb-placeholder" />
</template>

<style scoped>
.ingredient-thumb {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: contain;
  flex: none;
  border-radius: 0.25rem;
}

.ingredient-thumb-placeholder {
  background: rgba(0, 0, 0, 0.08);
}
</style>
