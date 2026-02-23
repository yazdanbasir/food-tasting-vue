<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSubmissionStore } from '@/stores/submission'

const store = useSubmissionStore()
const { masterGroceryList, totalCents } = storeToRefs(store)
</script>

<template>
  <div class="flex flex-col gap-4 overflow-y-auto">
    <div v-if="!Object.keys(masterGroceryList).length" class="text-sm text-gray-400">
      No ingredients across any submissions yet.
    </div>

    <div v-for="(items, aisle) in masterGroceryList" :key="aisle">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
        Aisle {{ aisle }}
      </h3>
      <ul class="space-y-1">
        <li
          v-for="item in items"
          :key="item.ingredient.product_id"
          class="flex items-center gap-2 text-sm"
        >
          <span class="flex-1 truncate">{{ item.ingredient.name }}</span>
          <span class="text-gray-500 flex-none">× {{ item.totalQuantity }}</span>
          <span class="w-16 text-right tabular-nums flex-none">
            ${{ ((item.ingredient.price_cents * item.totalQuantity) / 100).toFixed(2) }}
          </span>
        </li>
      </ul>
    </div>

    <div
      v-if="Object.keys(masterGroceryList).length"
      class="border-t border-gray-200 pt-2 text-sm font-semibold text-right tabular-nums"
    >
      Estimated Total: ${{ (totalCents / 100).toFixed(2) }}
    </div>
  </div>
</template>
