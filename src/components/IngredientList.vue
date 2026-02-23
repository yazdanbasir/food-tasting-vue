<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const store = useSubmissionStore()
const { ingredients, totalCents, canSubmit } = storeToRefs(store)
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
    <div v-if="ingredients.length" class="border-t border-gray-200 pt-2 mt-2 flex items-center">
      <button
        :disabled="!canSubmit"
        class="rounded-full px-4 py-1 min-h-8 bg-black text-white transition-opacity"
        :class="canSubmit ? 'opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'"
      >
        submit
      </button>
      <span class="flex-1 text-sm font-medium text-right tabular-nums">
        Total: ${{ (totalCents / 100).toFixed(2) }}
      </span>
    </div>
  </div>
</template>
