import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Ingredient } from '@/types/ingredient'
import type { MasterListItem, SubmissionIngredient } from '@/types/submission'
import type { SubmissionResponse } from '@/api/submissions'

export type OtherIngredientEntry = { item: string; size: string; quantity: string; additionalDetails: string }
export type UtensilEntry = { utensil: string; size: string; quantity: string }

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
  /** Contact info: name + phone pairs. At least one valid pair required to advance. */
  const contacts = ref<Array<{ name: string; phone: string }>>([
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
  ])
  const hasCookingPlace = ref<'yes' | 'no' | ''>('')
  const cookingLocation = ref('')
  const foundAllIngredients = ref<'yes' | 'no' | ''>('')
  const needsFridgeSpace = ref<'yes' | 'no' | ''>('')
  const needsUtensils = ref<'yes' | 'no' | ''>('')
  /** Utensil/equipment entries when needs_utensils is 'yes'. Each entry: utensil, size, quantity. Start with one empty row. */
  const utensilEntries = ref<UtensilEntry[]>([{ utensil: '', size: '', quantity: '' }])
  /** Other-store items when found_all_ingredients is 'no'. Each entry: item, size, quantity, additionalDetails. Start with one empty row. */
  const otherIngredientEntries = ref<OtherIngredientEntry[]>([{ item: '', size: '', quantity: '', additionalDetails: '' }])

  /** When set, form is in edit mode; submit becomes PATCH update */
  const editingSubmissionId = ref<number | null>(null)

  /** True when editing from organizer (Dishes tab); false when editing from confirmation (user flow) */
  const editingAsOrganizer = ref(false)

  /** Submission just created; used on confirmation page for "Edit Submission" */
  const lastSubmittedSubmission = ref<SubmissionResponse | null>(null)

  /** After organizer saves an edit, hold the API result here so the dashboard can merge it into the list (ensures other_ingredients etc. show without waiting for refetch). */
  const pendingOrganizerMerge = ref<SubmissionResponse | null>(null)
  function setPendingOrganizerMerge(sub: SubmissionResponse | null) {
    pendingOrganizerMerge.value = sub
  }

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
      ingredients.value = ingredients.value.map((i) =>
        i.ingredient.product_id === ingredient.product_id
          ? { ...i, quantity: i.quantity + qty }
          : i,
      )
    } else {
      ingredients.value = [...ingredients.value, { ingredient, quantity: qty }]
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

  /** Contacts with non-empty name and valid US phone. */
  const validContacts = computed(() =>
    contacts.value.filter(
      (c) =>
        c.name.trim().length > 0 &&
        c.phone.trim().length > 0 &&
        isUSPhoneNumber(c.phone),
    ),
  )

  /** Valid phone numbers (for API payload). */
  const validPhoneNumbers = computed(() =>
    validContacts.value.map((c) => c.phone.trim()),
  )

  const canAdvancePage1 = computed(
    () =>
      !!countryCode.value &&
      dishName.value.trim().length > 0 &&
      validContacts.value.length > 0 &&
      ingredients.value.length > 0,
  )

  /** Entries with at least item filled (required to submit when found_all_ingredients is 'no'). */
  const validOtherIngredientEntries = computed(() =>
    otherIngredientEntries.value.filter((e) => e.item.trim() !== ''),
  )

  /** Entries with at least utensil filled (required to submit when needs_utensils is 'yes'). */
  const validUtensilEntries = computed(() =>
    utensilEntries.value.filter((e) => e.utensil.trim() !== ''),
  )

  const canSubmit = computed(
    () =>
      canAdvancePage1.value &&
      foundAllIngredients.value !== '' &&
      (foundAllIngredients.value !== 'no' || validOtherIngredientEntries.value.length >= 1) &&
      hasCookingPlace.value !== '' &&
      (hasCookingPlace.value !== 'yes' || cookingLocation.value.trim().length > 0) &&
      needsFridgeSpace.value !== '' &&
      needsUtensils.value !== '' &&
      (needsUtensils.value !== 'yes' || validUtensilEntries.value.length >= 1),
  )

  function addOtherIngredientEntry() {
    otherIngredientEntries.value = [...otherIngredientEntries.value, { item: '', size: '', quantity: '', additionalDetails: '' }]
  }

  function removeOtherIngredientEntry(index: number) {
    if (otherIngredientEntries.value.length <= 1) return
    otherIngredientEntries.value = otherIngredientEntries.value.filter((_, i) => i !== index)
  }

  function addUtensilEntry() {
    utensilEntries.value = [...utensilEntries.value, { utensil: '', size: '', quantity: '' }]
  }

  function removeUtensilEntry(index: number) {
    if (utensilEntries.value.length <= 1) return
    utensilEntries.value = utensilEntries.value.filter((_, i) => i !== index)
  }

  function addContact() {
    contacts.value = [...contacts.value, { name: '', phone: '' }]
  }

  function removeContact(index: number) {
    if (contacts.value.length <= 1) return
    contacts.value = contacts.value.filter((_, i) => i !== index)
  }

  function reset() {
    teamName.value = ''
    dishName.value = ''
    countryCode.value = ''
    members.value = []
    contacts.value = [
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
    ]
    hasCookingPlace.value = ''
    cookingLocation.value = ''
    foundAllIngredients.value = ''
    needsFridgeSpace.value = ''
    needsUtensils.value = ''
    utensilEntries.value = [{ utensil: '', size: '', quantity: '' }]
    otherIngredientEntries.value = [{ item: '', size: '', quantity: '', additionalDetails: '' }]
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
    const names = sub.members || []
    const raw = (sub.phone_number ?? '').trim()
    const phones = raw ? raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean) : []
    const maxLen = Math.max(names.length, phones.length, 1)
    const zipped = Array.from({ length: maxLen }, (_, i) => ({
      name: (names[i] ?? '').trim(),
      phone: phones[i] ?? '',
    }))
    const defaultRows = [
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
    ]
    contacts.value =
      zipped.length >= 3 ? zipped : [...zipped, ...defaultRows.slice(zipped.length)]
    hasCookingPlace.value = (sub.has_cooking_place as 'yes' | 'no' | '') ?? ''
    cookingLocation.value = sub.cooking_location ?? ''
    foundAllIngredients.value = (sub.found_all_ingredients as 'yes' | 'no' | '') ?? ''
    needsFridgeSpace.value = (sub.needs_fridge_space as 'yes' | 'no' | '') ?? ''
    needsUtensils.value = (sub.needs_utensils as 'yes' | 'no' | '') ?? ''
    const rawUtensils = (sub.utensils_notes ?? '').trim()
    if (rawUtensils) {
      try {
        const parsed = JSON.parse(rawUtensils) as unknown
        if (Array.isArray(parsed)) {
          utensilEntries.value = parsed.map((row) => ({
            utensil: String((row as { utensil?: string }).utensil ?? ''),
            size: String((row as { size?: string }).size ?? ''),
            quantity: String((row as { quantity?: string }).quantity ?? ''),
          }))
        } else {
          utensilEntries.value = [{ utensil: rawUtensils, size: '', quantity: '' }]
        }
      } catch {
        utensilEntries.value = [{ utensil: rawUtensils, size: '', quantity: '' }]
      }
    } else {
      utensilEntries.value = [{ utensil: '', size: '', quantity: '' }]
    }
    const rawOther = (sub.other_ingredients ?? '').trim()
    console.log('[Other ingredients] loadForEdit — sub.other_ingredients (raw):', rawOther || '(empty)')
    if (rawOther) {
      try {
        const parsed = JSON.parse(rawOther) as unknown
        if (Array.isArray(parsed)) {
          otherIngredientEntries.value = parsed.map((row) => {
            const r = row as Record<string, unknown>
            return {
              item: String(r?.item ?? '').trim(),
              size: String(r?.size ?? '').trim(),
              quantity: String(r?.quantity ?? '').trim(),
              additionalDetails: String(r?.additionalDetails ?? r?.additional_details ?? '').trim(),
            }
          })
          if (otherIngredientEntries.value.length === 0) {
            otherIngredientEntries.value = [{ item: '', size: '', quantity: '', additionalDetails: '' }]
          }
        } else {
          otherIngredientEntries.value = [{ item: rawOther, size: '', quantity: '', additionalDetails: '' }]
        }
        console.log('[Other ingredients] loadForEdit — parsed entries:', JSON.parse(JSON.stringify(otherIngredientEntries.value)))
      } catch (e) {
        console.log('[Other ingredients] loadForEdit — JSON parse error:', e)
        otherIngredientEntries.value = [{ item: rawOther, size: '', quantity: '', additionalDetails: '' }]
      }
    } else {
      console.log('[Other ingredients] loadForEdit — no raw value, setting default empty row')
      otherIngredientEntries.value = [{ item: '', size: '', quantity: '', additionalDetails: '' }]
    }
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
    contacts,
    validContacts,
    validPhoneNumbers,
    addContact,
    removeContact,
    hasCookingPlace,
    cookingLocation,
    foundAllIngredients,
    needsFridgeSpace,
    needsUtensils,
    utensilEntries,
    validUtensilEntries,
    addUtensilEntry,
    removeUtensilEntry,
    otherIngredientEntries,
    validOtherIngredientEntries,
    addOtherIngredientEntry,
    removeOtherIngredientEntry,
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
    pendingOrganizerMerge,
    setPendingOrganizerMerge,
    isUSPhoneNumber,
  }
})
