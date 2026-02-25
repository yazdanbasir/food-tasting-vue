import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Ingredient } from '@/types/ingredient'
import type { MasterListItem, SubmissionIngredient } from '@/types/submission'
import type { SubmissionResponse } from '@/api/submissions'

export const useSubmissionStore = defineStore('submission', () => {
  const teamName = ref('')
  const dishName = ref('')
  const countryCode = ref('')
  const members = ref<string[]>([])
  const phoneNumber = ref('')

  /** When set, form is in edit mode; submit becomes PATCH update */
  const editingSubmissionId = ref<number | null>(null)

  function addMember(name: string) {
    const trimmed = name.trim()
    if (trimmed && !members.value.includes(trimmed)) {
      members.value.push(trimmed)
    }
  }

  function removeMember(name: string) {
    members.value = members.value.filter((m) => m !== name)
  }

  // The current team's ingredient list being built
  const ingredients = ref<SubmissionIngredient[]>([])

  // Add an ingredient — if already in the list, add to quantity; otherwise add with given quantity
  function addIngredient(ingredient: Ingredient, quantity = 1) {
    const qty = Math.max(1, quantity)
    const existing = ingredients.value.find(
      (i) => i.ingredient.product_id === ingredient.product_id,
    )
    if (existing) {
      existing.quantity += qty
    } else {
      ingredients.value.push({ ingredient, quantity: qty })
    }
  }

  function removeIngredient(productId: string) {
    ingredients.value = ingredients.value.filter(
      (i) => i.ingredient.product_id !== productId,
    )
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = ingredients.value.find((i) => i.ingredient.product_id === productId)
    if (item) item.quantity = Math.max(1, quantity)
  }

  // Running total in cents
  const totalCents = computed(() =>
    ingredients.value.reduce(
      (sum, { ingredient, quantity }) => sum + ingredient.price_cents * quantity,
      0,
    ),
  )

  // Aggregate all ingredients by aisle, sorted numerically then alphabetically
  const masterGroceryList = computed<Record<string, MasterListItem[]>>(() => {
    const grouped: Record<string, MasterListItem[]> = {}

    for (const { ingredient, quantity } of ingredients.value) {
      const aisle = ingredient.aisle ?? 'Unknown'
      if (!grouped[aisle]) grouped[aisle] = []

      const existing = grouped[aisle].find(
        (item) => item.ingredient.product_id === ingredient.product_id,
      )
      if (existing) {
        existing.totalQuantity += quantity
      } else {
        grouped[aisle].push({ ingredient, totalQuantity: quantity, teams: [] })
      }
    }

    // Sort: numeric aisles first (1, 2, 3...), then alphabetical (Produce, Unknown...)
    return Object.fromEntries(
      Object.entries(grouped).sort(([a], [b]) => {
        const numA = parseInt(a)
        const numB = parseInt(b)
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB
        if (!isNaN(numA)) return -1
        if (!isNaN(numB)) return 1
        return a.localeCompare(b)
      }),
    )
  })

  const canSubmit = computed(
    () =>
      !!countryCode.value &&
      dishName.value.trim().length > 0 &&
      members.value.length > 0 &&
      ingredients.value.length > 0,
  )

  function reset() {
    teamName.value = ''
    dishName.value = ''
    countryCode.value = ''
    members.value = []
    phoneNumber.value = ''
    ingredients.value = []
  }

  /** Map API ingredient response to frontend Ingredient (price, category) */
  function mapResponseIngredient(raw: SubmissionResponse['ingredients'][0]['ingredient']): Ingredient {
    return {
      ...raw,
      price: raw.price_cents / 100,
      category: null,
    }
  }

  function loadForEdit(sub: SubmissionResponse) {
    editingSubmissionId.value = sub.id
    dishName.value = sub.dish_name
    countryCode.value = sub.country_code ?? ''
    members.value = [...(sub.members || [])]
    ingredients.value = sub.ingredients.map((item) => ({
      ingredient: mapResponseIngredient(item.ingredient),
      quantity: item.quantity,
    }))
  }

  function clearEdit() {
    editingSubmissionId.value = null
    reset()
  }

  return {
    teamName,
    dishName,
    countryCode,
    members,
    phoneNumber,
    editingSubmissionId,
    addMember,
    removeMember,
    ingredients,
    totalCents,
    masterGroceryList,
    canSubmit,
    addIngredient,
    removeIngredient,
    updateQuantity,
    reset,
    loadForEdit,
    clearEdit,
  }
})
