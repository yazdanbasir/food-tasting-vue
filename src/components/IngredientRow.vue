<script setup lang="ts">
import '@/styles/form-section.css'
import IngredientThumb from '@/components/IngredientThumb.vue'
import DietaryIcons from '@/components/DietaryIcons.vue'
import type { Ingredient } from '@/types/ingredient'
import { ref, computed, watch, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    ingredient: Ingredient
    quantity: number
    editable?: boolean
    showPrice?: boolean
  }>(),
  { editable: false, showPrice: false }
)

const emit = defineEmits<{
  changeQty: [delta: number]
}>()

function changeQty(delta: number) {
  emit('changeQty', delta)
}

// Lightbox
const lightboxOpen = ref(false)
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:1826'

const lightboxSrc = computed(() => {
  const url = props.ingredient?.image_url
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const base = API_BASE.replace(/\/$/, '')
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${base}${path}`
})

function openLightbox() {
  if (lightboxSrc.value) lightboxOpen.value = true
}
function closeLightbox() {
  lightboxOpen.value = false
}
function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

watch(lightboxOpen, (open) => {
  if (open) document.addEventListener('keydown', handleEsc)
  else document.removeEventListener('keydown', handleEsc)
})
onUnmounted(() => document.removeEventListener('keydown', handleEsc))
</script>

<template>
  <div class="ingredient-row">
    <IngredientThumb
      :ingredient="ingredient"
      :class="lightboxSrc ? 'ingredient-thumb-clickable' : ''"
      @click="openLightbox"
    />
    <div class="ingredient-row-info">
      <div class="ingredient-row-name">{{ ingredient.name }}</div>
      <div class="ingredient-row-size">{{ ingredient.size }}</div>
    </div>
    <div class="ingredient-row-dietary">
      <DietaryIcons :dietary="ingredient.dietary" :size="16" />
    </div>
    <div v-if="editable" class="ingredient-row-actions">
      <span class="qty-controls">
        <span class="tabular-nums qty-num">{{ quantity }}</span>
        <span class="qty-btn-stack">
          <button
            type="button"
            class="qty-btn"
            aria-label="Increase quantity"
            @click="changeQty(1)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
          <button
            type="button"
            class="qty-btn"
            aria-label="Decrease quantity"
            @click="changeQty(-1)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </span>
      </span>
    </div>
    <template v-else>
      <span v-if="quantity > 0" class="ingredient-row-qty-readonly tabular-nums">× {{ quantity }}</span>
      <span v-if="showPrice" class="ingredient-row-price tabular-nums text-right">
        ${{ ((ingredient.price_cents * quantity) / 100).toFixed(2) }}
      </span>
    </template>
  </div>

  <Teleport to="body">
    <div v-if="lightboxOpen" class="lightbox-overlay" @click.self="closeLightbox">
      <div class="lightbox-window">
        <button class="btn-pill-primary lightbox-close" aria-label="Close" @click="closeLightbox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <img :src="lightboxSrc!" :alt="ingredient.name" class="lightbox-img" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ingredient-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s, border-color 0.15s, background-color 0.15s;
}

.ingredient-row:hover {
  background: #fafafa;
  border-color: #d5d5d5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.ingredient-row-info {
  flex: 1;
  min-width: 0;
}

.ingredient-row-dietary {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.ingredient-row-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
}

.ingredient-row-size {
  font-size: 0.9375rem;
  color: #666;
  margin-top: 0.125rem;
}

.ingredient-row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: none;
  align-self: stretch;
  border-left: 1px solid rgba(0, 0, 0, 0.15);
  padding-left: 1rem;
}

.ingredient-row-qty-readonly {
  flex: none;
  color: var(--color-lafayette-gray, #3c373c);
}

.ingredient-row-price {
  flex: none;
  min-width: 5rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.ingredient-thumb-clickable {
  cursor: zoom-in;
}

/* Lightbox */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.lightbox-window {
  position: relative;
  display: inline-flex;
}

.lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 0.5rem;
  pointer-events: none;
  user-select: none;
  display: block;
}

.lightbox-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  min-height: unset;
  border-radius: 50%;
  font-size: 1rem;
  z-index: 1;
}
</style>
