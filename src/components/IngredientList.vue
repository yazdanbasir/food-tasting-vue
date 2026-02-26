<script setup lang="ts">
import '@/styles/form-section.css'
import { storeToRefs } from 'pinia'
import IngredientRow from '@/components/IngredientRow.vue'
import { useSubmissionStore } from '@/stores/submission'

const store = useSubmissionStore()
const { ingredients } = storeToRefs(store)

function changeQty(productId: string, delta: number) {
  const item = ingredients.value.find((i) => i.ingredient.product_id === productId)
  if (!item) return
  const newQty = item.quantity + delta
  if (newQty < 1) store.removeIngredient(productId)
  else store.updateQuantity(productId, newQty)
}
</script>

<template>
  <div class="ingredient-list">
    <!-- Empty state -->
    <div v-if="!ingredients.length" class="ingredient-list-empty">
      No ingredients added yet. Search to add items.
    </div>

    <!-- List -->
    <ul v-else class="ingredient-list-ul">
      <li
        v-for="item in ingredients"
        :key="item.ingredient.product_id"
        class="ingredient-list-li"
      >
        <IngredientRow
          :ingredient="item.ingredient"
          :quantity="item.quantity"
          :editable="true"
          @change-qty="(delta) => changeQty(item.ingredient.product_id, delta)"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ingredient-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: 1.125rem;
}

.ingredient-list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
  padding: 0.25rem 0;
  text-align: center;
}

.ingredient-list-ul {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ingredient-list-li {
  list-style: none;
}
</style>
