<script setup lang="ts">
import { useIngredientSearch } from '@/composables/useIngredientSearch'
import { useSubmissionStore } from '@/stores/submission'
import type { Ingredient } from '@/types/ingredient'

const { query, results, isLoading, error, clear } = useIngredientSearch()
const store = useSubmissionStore()

const showDropdown = () =>
  isLoading.value || !!error.value || (query.value.length >= 2 && results.value.length === 0) || results.value.length > 0

function select(ingredient: Ingredient) {
  store.addIngredient(ingredient)
  clear()
}
</script>

<template>
  <div class="relative flex items-center gap-4">
    <!-- Spacer matches the "search" title pill width -->
    <div class="min-w-[5.5rem] flex-none" />

    <input
      v-model="query"
      type="text"
      placeholder="search for an ingredient..."
      class="flex-1 bg-white rounded-full px-4 py-1 min-h-8 outline-none border-0 placeholder:text-gray-400"
      @keydown.escape="clear"
    />

    <!-- Dropdown -->
    <div
      v-if="showDropdown()"
      class="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-lg overflow-hidden z-50"
    >
      <div v-if="isLoading" class="text-xs text-gray-400 px-4 py-3">searching...</div>
      <div v-else-if="error" class="text-xs text-red-400 px-4 py-3">{{ error }}</div>
      <div v-else-if="query.length >= 2 && results.length === 0" class="text-xs text-gray-400 px-4 py-3">
        no results for "{{ query }}"
      </div>

      <ul v-if="results.length" class="max-h-96 overflow-y-auto">
        <li
          v-for="ingredient in results"
          :key="ingredient.product_id"
          class="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-[#ececf1] transition-colors"
          @mousedown.prevent="select(ingredient)"
        >
          <img
            v-if="ingredient.image_url"
            :src="ingredient.image_url"
            :alt="ingredient.name"
            class="w-14 h-14 object-contain flex-none rounded-xl"
          />
          <div v-else class="w-14 h-14 flex-none rounded-xl bg-[#ececf1]" />

          <div class="flex-1 min-w-0">
            <div class="text-sm leading-snug truncate">{{ ingredient.name }}</div>
            <div class="text-sm text-gray-400 leading-snug">{{ ingredient.size }}</div>
          </div>

          <div class="text-sm text-gray-500 flex-none tabular-nums">
            ${{ (ingredient.price_cents / 100).toFixed(2) }}
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
