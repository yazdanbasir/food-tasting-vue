<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Ingredient } from '@/types/ingredient'

const props = defineProps<{
  ingredient: Ingredient
}>()

const imageLoadFailed = ref(false)
const imageLoaded = ref(false)
watch(
  () => [props.ingredient?.id, props.ingredient?.image_url],
  () => {
    imageLoadFailed.value = false
    imageLoaded.value = false
  }
)
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const imageSrc = computed(() => {
  const url = props.ingredient?.image_url
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const base = API_BASE.replace(/\/$/, '')
  return base ? `${base}${url.startsWith('/') ? url : `/${url}`}` : url
})

const showImage = computed(
  () => imageSrc.value && !imageLoadFailed.value && imageLoaded.value
)
</script>

<template>
  <div class="ingredient-thumb-wrap">
    <img
      v-if="imageSrc && !imageLoadFailed"
      :src="imageSrc"
      :alt="ingredient.name"
      class="ingredient-thumb"
      loading="lazy"
      decoding="async"
      @load="imageLoaded = true"
      @error="imageLoadFailed = true"
    />
    <div
      v-show="!showImage"
      class="ingredient-thumb ingredient-thumb-placeholder"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.ingredient-thumb-wrap {
  position: relative;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  border-radius: 0.25rem;
}

.ingredient-thumb {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 0.25rem;
}

.ingredient-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 0.25rem;
}
</style>
