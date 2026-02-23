<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'
import { createSubmission } from '@/api/submissions'

const store = useSubmissionStore()
const { ingredients, totalCents, canSubmit } = storeToRefs(store)
const router = useRouter()

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return

  isSubmitting.value = true
  submitError.value = null

  try {
    const result = await createSubmission({
      team_name: store.teamName,
      dish_name: store.dishName,
      notes: '',
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
  <div class="flex flex-col h-full">
    <!-- Empty state -->
    <div v-if="!ingredients.length" class="text-sm text-gray-400 py-1">
      No ingredients added yet. Search above to add items.
    </div>

    <!-- List -->
    <ul v-else class="flex-1 overflow-y-auto divide-y divide-gray-200">
      <li
        v-for="item in ingredients"
        :key="item.ingredient.product_id"
        class="flex items-center gap-3 py-2"
      >
        <img
          v-if="item.ingredient.image_url"
          :src="item.ingredient.image_url"
          :alt="item.ingredient.name"
          class="w-8 h-8 object-contain flex-none"
        />
        <div v-else class="w-8 h-8 flex-none bg-gray-100 rounded" />

        <div class="flex-1 min-w-0">
          <div class="text-sm truncate">{{ item.ingredient.name }}</div>
          <div class="text-xs text-gray-400">{{ item.ingredient.size }}</div>
        </div>

        <div class="flex items-center gap-2 flex-none">
          <!-- Quantity -->
          <input
            type="number"
            :value="item.quantity"
            min="1"
            class="w-14 border border-gray-300 rounded px-2 py-0.5 text-sm text-center bg-white"
            @change="
              store.updateQuantity(
                item.ingredient.product_id,
                Number(($event.target as HTMLInputElement).value),
              )
            "
          />

          <!-- Line total -->
          <span class="text-sm w-16 text-right tabular-nums">
            ${{ ((item.ingredient.price_cents * item.quantity) / 100).toFixed(2) }}
          </span>

          <!-- Remove -->
          <button
            class="text-gray-300 hover:text-red-500 text-xl leading-none transition-colors"
            @click="store.removeIngredient(item.ingredient.product_id)"
          >
            ×
          </button>
        </div>
      </li>
    </ul>

    <!-- Total + Submit -->
    <div v-if="ingredients.length" class="border-t border-gray-200 pt-2 mt-2 flex items-center gap-3">
      <button
        :disabled="!canSubmit || isSubmitting"
        class="rounded-full px-4 py-1 min-h-8 bg-black text-white transition-opacity"
        :class="canSubmit && !isSubmitting ? 'opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
        @click="handleSubmit"
      >
        {{ isSubmitting ? 'submitting...' : 'submit' }}
      </button>
      <span v-if="submitError" class="text-xs text-red-500 flex-1">{{ submitError }}</span>
      <span v-else class="flex-1 text-sm font-medium text-right tabular-nums">
        Total: ${{ (totalCents / 100).toFixed(2) }}
      </span>
    </div>
  </div>
</template>
