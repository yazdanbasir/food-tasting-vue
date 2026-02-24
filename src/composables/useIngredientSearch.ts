import { ref, watch } from 'vue'
import { searchIngredients } from '@/api/ingredients'
import { useIngredientCacheStore } from '@/stores/ingredientCache'
import type { Ingredient } from '@/types/ingredient'

// Mirrors the server-side Ingredient.search + order_by_relevance logic:
// - Every word in the query must appear in the name (AND logic)
// - Names starting with the first word come first, then sorted by position, then alphabetically
function searchLocal(query: string, all: Ingredient[]): Ingredient[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const first = terms[0] ?? ''

  const filtered = all.filter((i) => {
    const name = i.name.toLowerCase()
    return terms.every((t) => name.includes(t))
  })

  filtered.sort((a, b) => {
    const an = a.name.toLowerCase()
    const bn = b.name.toLowerCase()
    const startDiff = (an.startsWith(first) ? 0 : 1) - (bn.startsWith(first) ? 0 : 1)
    if (startDiff !== 0) return startDiff
    const posDiff = an.indexOf(first) - bn.indexOf(first)
    if (posDiff !== 0) return posDiff
    return an.localeCompare(bn)
  })

  return filtered.slice(0, 500)
}

export function useIngredientSearch() {
  const query = ref('')
  const results = ref<Ingredient[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const cache = useIngredientCacheStore()

  let debounceTimer: ReturnType<typeof setTimeout>

  watch(query, (val) => {
    clearTimeout(debounceTimer)
    error.value = null

    if (val.length < 2) {
      results.value = []
      return
    }

    if (cache.loaded) {
      results.value = searchLocal(val, cache.all)
      return
    }

    // Cache not ready yet — fall back to server API with debounce
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
