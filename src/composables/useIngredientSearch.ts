import { ref, watch } from 'vue'
import { searchIngredients } from '@/api/ingredients'
import type { Ingredient } from '@/types/ingredient'

export function useIngredientSearch() {
  const query = ref('')
  const results = ref<Ingredient[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout>

  watch(query, (val) => {
    clearTimeout(debounceTimer)
    error.value = null

    if (val.length < 2) {
      results.value = []
      return
    }

    debounceTimer = setTimeout(async () => {
      isLoading.value = true
      try {
        results.value = await searchIngredients(val)
      } catch {
        error.value = 'Search failed. Is the server running?'
        results.value = []
      } finally {
        isLoading.value = false
      }
    }, 300)
  })

  function clear() {
    query.value = ''
    results.value = []
    error.value = null
  }

  return { query, results, isLoading, error, clear }
}
