<script setup lang="ts">
import '@/styles/form-section.css'
import IngredientThumb from '@/components/IngredientThumb.vue'
import DietaryIcons from '@/components/DietaryIcons.vue'
import type { Ingredient } from '@/types/ingredient'

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
</script>

<template>
  <div class="ingredient-row">
    <IngredientThumb :ingredient="ingredient" />
    <div class="ingredient-row-info">
      <div class="ingredient-row-name truncate">{{ ingredient.name }}</div>
      <div class="ingredient-row-size">{{ ingredient.size }}</div>
    </div>
    <div class="ingredient-row-dietary">
      <DietaryIcons :dietary="ingredient.dietary" :size="16" />
    </div>
    <div v-if="editable" class="ingredient-row-actions">
      <span class="qty-controls">
        <button
          type="button"
          class="qty-btn"
          aria-label="Decrease quantity"
          @click="changeQty(-1)"
        >
          −
        </button>
        <span class="tabular-nums qty-num">{{ quantity }}</span>
        <button
          type="button"
          class="qty-btn"
          aria-label="Increase quantity"
          @click="changeQty(1)"
        >
          +
        </button>
      </span>
    </div>
    <template v-else>
      <span v-if="quantity > 0" class="ingredient-row-qty-readonly tabular-nums">× {{ quantity }}</span>
      <span v-if="showPrice" class="ingredient-row-price tabular-nums text-right">
        ${{ ((ingredient.price_cents * quantity) / 100).toFixed(2) }}
      </span>
    </template>
  </div>
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
</style>
