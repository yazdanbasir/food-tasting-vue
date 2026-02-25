import { ref, computed, watch } from 'vue'
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
  const rawResults = ref<Ingredient[]>([])
  const selectedCategory = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const cache = useIngredientCacheStore()

  const availableCategories = computed(() => {
    const cats = new Set<string>()
    for (const i of rawResults.value) {
      if (i.category) cats.add(i.category)
    }
    return [...cats].sort()
  })

  const results = computed(() =>
    selectedCategory.value
      ? rawResults.value.filter((i) => i.category === selectedCategory.value)
      : rawResults.value
  )

  function setCategory(cat: string | null) {
    selectedCategory.value = cat
  }

  let debounceTimer: ReturnType<typeof setTimeout>

  function runSearch(val: string) {
    clearTimeout(debounceTimer)
    error.value = null
    selectedCategory.value = null

    if (val.length < 2) {
      rawResults.value = []
      isLoading.value = false
      return
    }

    if (cache.loaded) {
      console.log(`[search] local for "${val}", cache has ${cache.all.length} items`)
      isLoading.value = false
      rawResults.value = searchLocal(val, cache.all)
      console.log(`[search] local found ${rawResults.value.length}`)
      return
    }

    console.log(`[search] cache not ready, debouncing API call for "${val}"`)
    // Cache not ready yet — fall back to server API with debounce
    debounceTimer = setTimeout(async () => {
      isLoading.value = true
      try {
        console.log(`[search] API call for "${val}"`)
        rawResults.value = await searchIngredients(val)
        console.log(`[search] API returned ${rawResults.value.length}`)
      } catch (err) {
        console.error('[search] API FAILED', err)
        error.value = 'Search failed. Is the server running?'
        rawResults.value = []
      } finally {
        isLoading.value = false
      }
    }, 300)
  }

  watch(query, runSearch)

  // When the cache finishes loading, immediately re-run the current query
  // so "searching..." clears and local results appear right away
  watch(() => cache.loaded, (loaded) => {
    if (loaded && query.value.length >= 2) {
      runSearch(query.value)
    }
  })

  function clear() {
    query.value = ''
    rawResults.value = []
    selectedCategory.value = null
    error.value = null
  }

  return { query, results, isLoading, error, clear, selectedCategory, availableCategories, setCategory }
}
