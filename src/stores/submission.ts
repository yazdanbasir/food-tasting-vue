import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Ingredient } from '@/types/ingredient'
import type { MasterListItem, SubmissionIngredient } from '@/types/submission'
import type { SubmissionResponse } from '@/api/submissions'

function isUSPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) return true
  if (digits.length === 11 && digits.startsWith('1')) return true
  return false
}

export const useSubmissionStore = defineStore('submission', () => {
  const teamName = ref('')
  const dishName = ref('')
  const countryCode = ref('')
  const members = ref<string[]>([])
  /** One or more US phone numbers. At least one valid number required to advance. */
  const phoneNumbers = ref<string[]>([''])
  const hasCookingPlace = ref<'yes' | 'no' | ''>('')
  const cookingLocation = ref('')
  const foundAllIngredients = ref<'yes' | 'no' | ''>('')
  const needsFridgeSpace = ref<'yes' | 'no' | ''>('')
  const needsUtensils = ref<'yes' | 'no' | ''>('')
  const utensilsNotes = ref('')
  const otherIngredients = ref('')

  /** When set, form is in edit mode; submit becomes PATCH update */
  const editingSubmissionId = ref<number | null>(null)

  /** True when editing from organizer (Dishes tab); false when editing from confirmation (user flow) */
  const editingAsOrganizer = ref(false)

  /** Submission just created; used on confirmation page for "Edit Submission" */
  const lastSubmittedSubmission = ref<SubmissionResponse | null>(null)

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

  const validPhoneNumbers = computed(() =>
    phoneNumbers.value
      .map((n) => n.trim())
      .filter((n) => n.length > 0 && isUSPhoneNumber(n)),
  )

  const canAdvancePage1 = computed(
    () =>
      !!countryCode.value &&
      dishName.value.trim().length > 0 &&
      members.value.length > 0 &&
      validPhoneNumbers.value.length > 0 &&
      ingredients.value.length > 0,
  )

  const canSubmit = computed(
    () =>
      canAdvancePage1.value &&
      foundAllIngredients.value !== '' &&
      hasCookingPlace.value !== '' &&
      (hasCookingPlace.value !== 'yes' || cookingLocation.value.trim().length > 0) &&
      needsFridgeSpace.value !== '' &&
      needsUtensils.value !== '',
  )

  function addPhone() {
    phoneNumbers.value = [...phoneNumbers.value, '']
  }

  function removePhone(index: number) {
    if (phoneNumbers.value.length <= 1) return
    phoneNumbers.value = phoneNumbers.value.filter((_, i) => i !== index)
  }

  function reset() {
    teamName.value = ''
    dishName.value = ''
    countryCode.value = ''
    members.value = []
    phoneNumbers.value = ['']
    hasCookingPlace.value = ''
    cookingLocation.value = ''
    foundAllIngredients.value = ''
    needsFridgeSpace.value = ''
    needsUtensils.value = ''
    utensilsNotes.value = ''
    otherIngredients.value = ''
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

  function loadForEdit(sub: SubmissionResponse, asOrganizer = false) {
    editingSubmissionId.value = sub.id
    editingAsOrganizer.value = asOrganizer
    dishName.value = sub.dish_name
    countryCode.value = sub.country_code ?? ''
    members.value = [...(sub.members || [])]
    const raw = (sub.phone_number ?? '').trim()
    phoneNumbers.value = raw ? raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean) : ['']
    if (phoneNumbers.value.length === 0) phoneNumbers.value = ['']
    hasCookingPlace.value = (sub.has_cooking_place as 'yes' | 'no' | '') ?? ''
    cookingLocation.value = sub.cooking_location ?? ''
    foundAllIngredients.value = (sub.found_all_ingredients as 'yes' | 'no' | '') ?? ''
    needsFridgeSpace.value = (sub.needs_fridge_space as 'yes' | 'no' | '') ?? ''
    needsUtensils.value = (sub.needs_utensils as 'yes' | 'no' | '') ?? ''
    utensilsNotes.value = sub.utensils_notes ?? ''
    otherIngredients.value = sub.other_ingredients ?? ''
    ingredients.value = sub.ingredients.map((item) => ({
      ingredient: mapResponseIngredient(item.ingredient),
      quantity: item.quantity,
    }))
  }

  function clearEdit() {
    editingSubmissionId.value = null
    editingAsOrganizer.value = false
    reset()
  }

  function setLastSubmitted(sub: SubmissionResponse | null) {
    lastSubmittedSubmission.value = sub
  }

  return {
    teamName,
    dishName,
    countryCode,
    members,
    phoneNumbers,
    validPhoneNumbers,
    addPhone,
    removePhone,
    hasCookingPlace,
    cookingLocation,
    foundAllIngredients,
    needsFridgeSpace,
    needsUtensils,
    utensilsNotes,
    otherIngredients,
    editingSubmissionId,
    editingAsOrganizer,
    addMember,
    removeMember,
    ingredients,
    totalCents,
    masterGroceryList,
    canAdvancePage1,
    canSubmit,
    addIngredient,
    removeIngredient,
    updateQuantity,
    reset,
    loadForEdit,
    clearEdit,
    lastSubmittedSubmission,
    setLastSubmitted,
    isUSPhoneNumber,
  }
})
