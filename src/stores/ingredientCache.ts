import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchAllIngredients } from '@/api/ingredients'
import type { Ingredient } from '@/types/ingredient'

export const useIngredientCacheStore = defineStore('ingredientCache', () => {
  const all = ref<Ingredient[]>([])
  const loaded = ref(false)

  async function preload() {
    if (loaded.value) return
    try {
      all.value = await fetchAllIngredients()
      loaded.value = true
    } catch {
      // Silently fail — useIngredientSearch will fall back to the server API
    }
  }

  return { all, loaded, preload }
})
