<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Ingredient } from '@/types/ingredient'

const props = defineProps<{
  ingredient: Ingredient
}>()

const imageLoadFailed = ref(false)
watch(() => [props.ingredient?.id, props.ingredient?.image_url], () => { imageLoadFailed.value = false })
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const imageSrc = computed(() => {
  const url = props.ingredient?.image_url
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const base = API_BASE.replace(/\/$/, '')
  return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url
})

const showImage = computed(() => imageSrc.value && !imageLoadFailed.value)
</script>

<template>
  <img
    v-if="showImage"
    :src="imageSrc!"
    :alt="ingredient.name"
    class="ingredient-thumb"
    @error="imageLoadFailed = true"
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
