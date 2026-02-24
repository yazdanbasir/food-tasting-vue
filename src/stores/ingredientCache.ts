import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchAllIngredients } from '@/api/ingredients'
import type { Ingredient } from '@/types/ingredient'

export const useIngredientCacheStore = defineStore('ingredientCache', () => {
  const all = ref<Ingredient[]>([])
  const loaded = ref(false)

  async function preload() {
    if (loaded.value) return
    console.log('[cache] preload start')
    try {
      const data = await fetchAllIngredients()
      all.value = data
      loaded.value = true
      console.log(`[cache] preload done — ${data.length} ingredients`)
    } catch (err) {
      console.error('[cache] preload FAILED', err)
    }
  }

  return { all, loaded, preload }
})
