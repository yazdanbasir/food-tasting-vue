<script setup lang="ts">
import '@/styles/form-section.css'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import IngredientRow from '@/components/IngredientRow.vue'
import { useSubmissionStore } from '@/stores/submission'
import { createSubmission, updateSubmission } from '@/api/submissions'

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

  const payload = {
    team_name: store.teamName,
    dish_name: store.dishName,
    notes: '',
    country_code: countryCode.value || '',
    members: [...members.value],
    phone_number: store.phoneNumber?.trim() || undefined,
    has_cooking_place: store.hasCookingPlace || undefined,
    cooking_location: store.hasCookingPlace === 'yes' ? store.cookingLocation?.trim() || undefined : undefined,
    ingredients: ingredients.value.map((item) => ({
      ingredient_id: item.ingredient.id,
      quantity: item.quantity,
    })),
  }

  try {
    const editingId = store.editingSubmissionId
    if (editingId != null) {
      const result = await updateSubmission(editingId, payload)
      const asOrganizer = store.editingAsOrganizer
      store.clearEdit()
      if (asOrganizer) {
        router.push('/organizer')
      } else {
        store.setLastSubmitted(result)
        router.push('/confirmation')
      }
    } else {
      const { submission } = await createSubmission(payload)
      store.reset()
      store.setLastSubmitted(submission)
      router.push('/confirmation')
    }
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

    <!-- Submit -->
    <div v-if="ingredients.length" class="ingredient-list-footer">
      <span v-if="submitError" class="ingredient-list-error">{{ submitError }}</span>
      <button
        type="button"
        :disabled="!canSubmit || isSubmitting"
        class="btn-pill-primary"
        @click="handleSubmit"
      >
        {{ isSubmitting ? (store.editingSubmissionId != null ? 'Updating...' : 'Submitting...') : (store.editingSubmissionId != null ? 'Update' : 'Submit') }}
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

.ingredient-list-footer .btn-pill-primary {
  margin-left: auto;
}

.ingredient-list-error {
  font-size: 1rem;
  color: #b91c1c;
}
</style>
