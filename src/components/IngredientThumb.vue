<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Ingredient } from '@/types/ingredient'

const props = defineProps<{
  ingredient: Pick<Ingredient, 'id' | 'name' | 'image_url'>
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
// Use same base as API so relative image_url (e.g. /uploads/...) resolve correctly
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:1826'

const imageSrc = computed(() => {
  const url = props.ingredient?.image_url
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = API_BASE.replace(/\/$/, '')
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${path}`
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
    >
      <svg class="ingredient-thumb-placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05" />
        <path d="M12 22.08V12" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.ingredient-thumb-wrap {
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
}
.ingredient-thumb-placeholder-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: rgba(0, 0, 0, 0.35);
}
</style>
