# Plan: Ingredient Search + Submission State (Frontend)

## Context
The Vue frontend is a fresh scaffold with no components, no stores, no API layer, and no types. The Rails backend is running at localhost:1826 with a working `GET /api/v1/ingredients?q=` endpoint. The goal is to build the ingredient search + live list functionality — data flow and state only, no styling.

---

## What We're Building
1. A search input that queries the Rails API as the user types and shows a dropdown of suggestions
2. A selected-ingredients list where users can adjust quantity or remove items
3. A store that holds all submissions and exposes two computed views:
   - **Master grocery list** — all ingredients across all submissions, aggregated by quantity, grouped by aisle
   - **Individual submissions list** — each team's submission separately

---

## Recommended Approach

### 1. Install Pinia
Pinia is the official Vue 3 state manager. The submission state (team name, dish, ingredient list) and the master list computation need to be shared across components. A composable alone isn't enough once there are multiple components reading and writing the same state.

```
npm install pinia
```

Register in `src/main.ts`:
```ts
import { createPinia } from 'pinia'
app.use(createPinia())
```

**Files modified:** `package.json`, `src/main.ts`

---

### 2. Add a Vite environment variable for the API URL
The API base URL should not be hardcoded. Vite exposes variables prefixed with `VITE_` to the client.

Create `.env` at project root:
```
VITE_API_BASE_URL=http://localhost:1826
```

**Files created:** `.env`

---

### 3. Define TypeScript types

**`src/types/ingredient.ts`**
```ts
export interface Ingredient {
  id: number
  product_id: string
  name: string
  size: string | null
  aisle: string | null
  category: string | null
  image_url: string | null
  price_cents: number
  price: number
  dietary: {
    is_alcohol: boolean
    gluten: boolean
    dairy: boolean
    egg: boolean
    peanut: boolean
    kosher: boolean
    vegan: boolean
    vegetarian: boolean
    lactose_free: boolean
    wheat_free: boolean
  }
}
```

**`src/types/submission.ts`**
```ts
import type { Ingredient } from './ingredient'

export interface SubmissionIngredient {
  ingredient: Ingredient
  quantity: number
}

export interface Submission {
  id: string           // generated client-side (crypto.randomUUID)
  teamName: string
  dishName: string
  members: string[]
  ingredients: SubmissionIngredient[]
  notes: string
  submittedAt: Date
}

// For the master grocery list
export interface MasterListItem {
  ingredient: Ingredient
  totalQuantity: number
  teams: string[]      // team names that need this item
}
```

**Files created:** `src/types/ingredient.ts`, `src/types/submission.ts`

---

### 4. Create the API utility

**`src/api/ingredients.ts`**

A thin fetch wrapper that reads `VITE_API_BASE_URL` and calls the search endpoint. Returns typed results. Throws on network error so the caller can handle it.

```ts
const BASE = import.meta.env.VITE_API_BASE_URL

export async function searchIngredients(query: string): Promise<Ingredient[]> {
  const res = await fetch(`${BASE}/api/v1/ingredients?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getIngredient(id: number): Promise<Ingredient> {
  const res = await fetch(`${BASE}/api/v1/ingredients/${id}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

**Files created:** `src/api/ingredients.ts`

---

### 5. Create the search composable

**`src/composables/useIngredientSearch.ts`**

Encapsulates all search logic so the component stays clean. Handles:
- `query` ref (bound to the input)
- `results` ref (API response)
- `isLoading` and `error` state
- 300ms debounce — waits for the user to stop typing before firing the API call
- Clears results when query is too short (< 2 chars, matching the backend guard)

No extra debounce library needed — implemented with `setTimeout` / `clearTimeout`.

```ts
export function useIngredientSearch() {
  const query = ref('')
  const results = ref<Ingredient[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout>

  watch(query, (val) => {
    clearTimeout(debounceTimer)
    if (val.length < 2) { results.value = []; return }
    debounceTimer = setTimeout(async () => {
      isLoading.value = true
      error.value = null
      try {
        results.value = await searchIngredients(val)
      } catch (e) {
        error.value = 'Search failed'
      } finally {
        isLoading.value = false
      }
    }, 300)
  })

  return { query, results, isLoading, error }
}
```

**Files created:** `src/composables/useIngredientSearch.ts`

---

### 6. Create the Pinia store

**`src/stores/submission.ts`**

This is the central state for the entire app. Holds all submissions and exposes:

- `currentDraft` — the submission currently being built (team name, dish, ingredient list)
- `allSubmissions` — array of all finalized submissions
- **Actions:** `addIngredient`, `removeIngredient`, `updateQuantity`, `saveSubmission`
- **Getters:**
  - `masterGroceryList` — computed: aggregates all submissions' ingredients, deduplicates by `product_id`, sums quantities, groups by aisle
  - `submissionsList` — the raw list of all saved submissions

```ts
// masterGroceryList getter logic:
// 1. Flatten all ingredients across all submissions
// 2. Group by product_id, summing quantities and collecting team names
// 3. Group the result by aisle (null aisle goes into 'Unknown')
// 4. Sort aisles numerically/alphabetically
// Returns: Record<string, MasterListItem[]>
```

**Files created:** `src/stores/submission.ts`

---

### 7. Create the components

**`src/components/IngredientSearch.vue`**
- Uses `useIngredientSearch` composable
- Renders `<input>` bound to `query`
- Shows a dropdown `<ul>` of results when `results.length > 0`
- Each result shows: name, size, price (formatted as $X.XX)
- Clicking a result emits `select(ingredient)` — parent handles adding to store
- Pressing Escape or clicking outside closes the dropdown
- Shows loading state and error state

**`src/components/IngredientList.vue`**
- Reads `currentDraft.ingredients` from the store
- Renders each item: name, size, quantity input (number, min 1), line total (qty × price), remove button
- Calls `store.updateQuantity()` and `store.removeIngredient()` directly

**`src/components/MasterGroceryList.vue`**
- Reads `masterGroceryList` getter from store
- Renders sections grouped by aisle
- Each section: aisle header, then list items (name, total qty, team names, total cost)
- Shows total estimated cost at the bottom (sum of all line totals)

**Files created:**
- `src/components/IngredientSearch.vue`
- `src/components/IngredientList.vue`
- `src/components/MasterGroceryList.vue`

---

### 8. Wire into HomeView

`src/views/HomeView.vue` imports and places the three components. The view handles the `select` event from `IngredientSearch` and calls `store.addIngredient(ingredient)`.

**Files modified:** `src/views/HomeView.vue`

---

## File Summary

| File | Status | Purpose |
|---|---|---|
| `src/main.ts` | modify | Register Pinia |
| `.env` | create | API base URL |
| `src/types/ingredient.ts` | create | Ingredient type |
| `src/types/submission.ts` | create | Submission + MasterListItem types |
| `src/api/ingredients.ts` | create | API fetch wrapper |
| `src/composables/useIngredientSearch.ts` | create | Debounced search logic |
| `src/stores/submission.ts` | create | All submission state + master list computation |
| `src/components/IngredientSearch.vue` | create | Search input + dropdown |
| `src/components/IngredientList.vue` | create | Selected ingredients list |
| `src/components/MasterGroceryList.vue` | create | Aggregated grocery list by aisle |
| `src/views/HomeView.vue` | modify | Wire components together |

---

## Verification

1. Start Rails: `cd backend && rails server` → confirms running on port 1826
2. Start Vue: `npm run dev` → opens at localhost:5173
3. Type "milk" in the search bar → dropdown appears with results from the API
4. Click a result → it appears in the ingredient list below
5. Change quantity → line total updates
6. Remove an item → it disappears from the list
7. Master grocery list updates live, grouped by aisle, with running total
