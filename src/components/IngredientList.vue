<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import IngredientThumb from '@/components/IngredientThumb.vue'
import { useSubmissionStore } from '@/stores/submission'
import { createSubmission } from '@/api/submissions'

const store = useSubmissionStore()
const { ingredients, canSubmit, countryCode, members } = storeToRefs(store)
const router = useRouter()

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

function changeQty(productId: string, delta: number) {
  const item = ingredients.value.find((i) => i.ingredient.product_id === productId)
  if (!item) return
  const newQty = item.quantity + delta
  if (newQty < 1) store.removeIngredient(productId)
  else store.updateQuantity(productId, newQty)
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
      No ingredients added yet. Search to add items.
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
        </div>
      </li>
    </ul>

    <!-- Submit -->
    <div v-if="ingredients.length" class="ingredient-list-footer">
      <span v-if="submitError" class="ingredient-list-error">{{ submitError }}</span>
      <button
        type="button"
        :disabled="!canSubmit || isSubmitting"
        class="ingredient-list-submit"
        :class="canSubmit && !isSubmitting ? 'ingredient-list-submit-enabled' : 'ingredient-list-submit-disabled'"
        @click="handleSubmit"
      >
        {{ isSubmitting ? 'Submitting...' : 'Submit' }}
      </button>
    </div>
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

.ingredient-list-row {
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

.ingredient-list-row:hover {
  background: #fafafa;
  border-color: #d5d5d5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.ingredient-list-info {
  flex: 1;
  min-width: 0;
}

.ingredient-list-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
}

.ingredient-list-size {
  font-size: 0.9375rem;
  color: #666;
  margin-top: 0.125rem;
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
  width: 2.25rem;
  height: 2.25rem;
  min-width: 2.25rem;
  min-height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.ingredient-list-qty-btn:hover {
  background: var(--color-lafayette-red, #910029);
  color: #fff;
  border-color: var(--color-lafayette-red, #910029);
}

.ingredient-list-qty-btn:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.ingredient-list-qty-num {
  min-width: 1.5rem;
  text-align: center;
}

.ingredient-list-footer {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: none;
}

.ingredient-list-footer .ingredient-list-error {
  flex: 1;
}

.ingredient-list-footer .ingredient-list-submit {
  margin-left: auto;
}

/* Match header tab nav: pill shape, padding, font */
.ingredient-list-submit {
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  min-height: 2.75rem;
  border: none;
  font-size: 1.25rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s, opacity 0.15s;
}

.ingredient-list-submit-enabled {
  background-color: var(--color-lafayette-red, #910029);
  color: #fff;
  cursor: pointer;
  opacity: 1;
  border: 1px solid var(--color-lafayette-red, #910029);
}

.ingredient-list-submit-enabled:hover {
  background-color: var(--color-lafayette-dark-blue, #6d001f);
  color: #fff;
  border-color: var(--color-lafayette-dark-blue, #6d001f);
}

.ingredient-list-submit-enabled:focus-visible {
  outline: 2px solid var(--color-lafayette-red, #910029);
  outline-offset: 2px;
}

.ingredient-list-submit-disabled {
  background-color: #e5e5e5;
  color: #737373;
  cursor: not-allowed;
  opacity: 0.8;
  border: 1px solid #d4d4d4;
}

.ingredient-list-error {
  font-size: 1rem;
  color: #b91c1c;
}
</style>
