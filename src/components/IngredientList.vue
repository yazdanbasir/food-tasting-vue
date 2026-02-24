<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import IngredientThumb from '@/components/IngredientThumb.vue'
import { useSubmissionStore } from '@/stores/submission'
import { createSubmission } from '@/api/submissions'

const store = useSubmissionStore()
const { ingredients, totalCents, canSubmit, countryCode, members } = storeToRefs(store)
const router = useRouter()

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

function changeQty(productId: string, delta: number) {
  const item = ingredients.value.find((i) => i.ingredient.product_id === productId)
  if (item) store.updateQuantity(productId, Math.max(1, item.quantity + delta))
}

async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return

  isSubmitting.value = true
  submitError.value = null

  try {
    const result = await createSubmission({
      team_name: store.teamName,
      dish_name: store.dishName,
      notes: '',
      country_code: countryCode.value || '',
      members: [...members.value],
      ingredients: ingredients.value.map((item) => ({
        ingredient_id: item.ingredient.id,
        quantity: item.quantity,
      })),
    })

    store.reset()
    router.push(`/confirmation/${result.access_code}`)
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Submission failed'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="ingredient-list">
    <!-- Empty state -->
    <div v-if="!ingredients.length" class="ingredient-list-empty">
      No ingredients added yet. Search above to add items.
    </div>

    <!-- List -->
    <ul v-else class="ingredient-list-ul">
      <li
        v-for="item in ingredients"
        :key="item.ingredient.product_id"
        class="ingredient-list-row"
      >
        <IngredientThumb :ingredient="item.ingredient" />

        <div class="ingredient-list-info">
          <div class="ingredient-list-name truncate">{{ item.ingredient.name }}</div>
          <div class="ingredient-list-size">{{ item.ingredient.size }}</div>
        </div>

        <div class="ingredient-list-actions">
          <span class="ingredient-list-qty-controls">
            <button
              type="button"
              class="ingredient-list-qty-btn"
              aria-label="Decrease quantity"
              @click="changeQty(item.ingredient.product_id, -1)"
            >
              −
            </button>
            <span class="tabular-nums ingredient-list-qty-num">{{ item.quantity }}</span>
            <button
              type="button"
              class="ingredient-list-qty-btn"
              aria-label="Increase quantity"
              @click="changeQty(item.ingredient.product_id, 1)"
            >
              +
            </button>
          </span>
          <span class="ingredient-list-price tabular-nums">
            ${{ ((item.ingredient.price_cents * item.quantity) / 100).toFixed(2) }}
          </span>
          <button
            type="button"
            class="ingredient-list-remove"
            aria-label="Remove ingredient"
            @click="store.removeIngredient(item.ingredient.product_id)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>

    <!-- Total + Submit -->
    <div v-if="ingredients.length" class="ingredient-list-footer">
      <button
        type="button"
        :disabled="!canSubmit || isSubmitting"
        class="ingredient-list-submit"
        :class="canSubmit && !isSubmitting ? 'ingredient-list-submit-enabled' : 'ingredient-list-submit-disabled'"
        @click="handleSubmit"
      >
        {{ isSubmitting ? 'submitting...' : 'submit' }}
      </button>
      <span v-if="submitError" class="ingredient-list-error">{{ submitError }}</span>
      <span v-else class="ingredient-list-total tabular-nums">
        Total: ${{ (totalCents / 100).toFixed(2) }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.ingredient-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-size: var(--body-font-size, 1.125rem);
}

.ingredient-list-empty {
  font-size: 1rem;
  color: var(--color-lafayette-gray, #3c373c);
  padding: 0.25rem 0;
}

.ingredient-list-ul {
  flex: 1;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--color-lafayette-gray, #3c373c);
}

.ingredient-list-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-lafayette-gray, #3c373c);
}

.ingredient-list-info {
  flex: 1;
  min-width: 0;
}

.ingredient-list-name {
  font-size: 1rem;
}

.ingredient-list-size {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.ingredient-list-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: none;
}

.ingredient-list-qty-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.ingredient-list-qty-btn {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #fff;
  color: #000;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  font-size: 1.125rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.ingredient-list-qty-btn:hover {
  background: var(--color-lafayette-dark-blue, #006690);
  color: #fff;
  border-color: var(--color-lafayette-dark-blue, #006690);
}

.ingredient-list-qty-btn:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.ingredient-list-qty-num {
  min-width: 1.5rem;
  text-align: center;
}

.ingredient-list-price {
  width: 4rem;
  text-align: right;
  font-size: 1rem;
}

.ingredient-list-remove {
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--color-lafayette-gray, #3c373c);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s;
}

.ingredient-list-remove:hover {
  color: var(--color-lafayette-red, #910029);
}

.ingredient-list-remove:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.ingredient-list-footer {
  border-top: 1px solid var(--color-lafayette-gray, #3c373c);
  padding-top: 1rem;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.ingredient-list-submit {
  border-radius: 9999px;
  padding: calc(0.667em + 2px) calc(1.333em + 2px);
  min-height: 2.5rem;
  border: none;
  font-size: 1rem;
  transition: background-color 0.15s, opacity 0.15s;
}

.ingredient-list-submit-enabled {
  background-color: var(--color-lafayette-red, #910029);
  color: #fff;
  cursor: pointer;
  opacity: 1;
}

.ingredient-list-submit-enabled:hover {
  background-color: var(--color-lafayette-dark-blue, #006690);
}

.ingredient-list-submit-enabled:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.ingredient-list-submit-disabled {
  background-color: var(--color-lafayette-gray, #3c373c);
  color: #fff;
  cursor: not-allowed;
  opacity: 0.6;
}

.ingredient-list-error {
  flex: 1;
  font-size: 0.875rem;
  color: #b91c1c;
}

.ingredient-list-total {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  text-align: right;
}
</style>
