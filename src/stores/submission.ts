import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Ingredient } from '@/types/ingredient'
import type { MasterListItem, SubmissionIngredient } from '@/types/submission'
import type { SubmissionResponse } from '@/api/submissions'

export type OtherIngredientEntry = { item: string; size: string; quantity: string; quantityUnit: string; additionalDetails: string }

/** Container/package type for "other" ingredients (e.g. bottle, can). */
export const OTHER_INGREDIENT_SIZE_OPTIONS = [
  '', 'Bottle', 'Can', 'Jar', 'Box', 'Bag', 'Pack', 'Carton', 'Tub', 'Tube', 'Loaf', 'Bunch', 'Clamshell', 'Sleeve', 'Canister', 'Pint', 'Quart', 'Other',
] as const

/** Quantity units for "other" ingredients (number + unit). */
export const OTHER_INGREDIENT_QUANTITY_UNITS = [
  '', 'each', 'oz', 'lb', 'g', 'ml', 'fl oz', 'L', 'box', 'bag', 'pack', 'bunch', 'loaf', 'bottle', 'can', 'jar', 'slice', 'clove', 'head', 'stalk', 'piece', 'cup', 'tbsp', 'tsp', 'Other',
] as const

export type UtensilEntry = { utensil: string; size: string; quantity: string }

export type MeatEntry = { meatType: string; cut: string; quantity: string; quantityUnit: string; additionalDetails: string }

/** Available meat types for the Meat section. */
export const MEAT_TYPE_OPTIONS = [
  '', 'Chicken', 'Beef', 'Lamb', 'Goat', 'Turkey', 'Other',
] as const

/** Cut/type options per meat. */
export const MEAT_CUT_OPTIONS: Record<string, readonly string[]> = {
  Chicken: ['', 'Whole', 'Breast', 'Thigh', 'Drumstick', 'Wings', 'Leg Quarters', 'Tenders', 'Ground', 'Other'],
  Beef: ['', 'Ground', 'Stew Meat', 'Chuck Roast', 'Ribeye', 'Sirloin', 'Flank', 'Brisket', 'Short Ribs', 'Shank', 'Other'],
  Lamb: ['', 'Ground', 'Leg', 'Shoulder', 'Rack', 'Chops', 'Shank', 'Stew Meat', 'Other'],
  Goat: ['', 'Whole', 'Leg', 'Shoulder', 'Chops', 'Stew Meat', 'Ground', 'Ribs', 'Other'],
  Turkey: ['', 'Whole', 'Breast', 'Ground', 'Thigh', 'Drumstick', 'Wings', 'Other'],
  Other: ['', 'Other'],
} as const

/** Quantity units for meat. */
export const MEAT_QUANTITY_UNITS = [
  '', 'lb', 'kg', 'oz', 'each', 'pack', 'whole', 'Other',
] as const

/** True if the string contains only digits and common phone formatting (+, spaces, dashes, parentheses). */
function isPhoneNumbersOnly(value: string): boolean {
  if (!value.trim()) return true
  if (!/^\+?[\d\s\-()]*$/.test(value)) return false
  return value.replace(/\D/g, '').length >= 1
}

export const useSubmissionStore = defineStore('submission', () => {
  const teamName = ref('')
  const dishName = ref('')
  const countryCode = ref('')
  /** When country is "Other", user types the country name here (dish bar only). */
  const countryNameOther = ref('')
  const members = ref<string[]>([])
  /** Contact info: name, optional country code, and phone. At least one valid pair required to advance. */
  const contacts = ref<Array<{ name: string; phone: string; countryCode: string }>>([
    { name: '', phone: '', countryCode: '' },
    { name: '', phone: '', countryCode: '' },
    { name: '', phone: '', countryCode: '' },
  ])
  const hasCookingPlace = ref<boolean | null>(null)
  const cookingLocation = ref('')
  const needsFridgeSpace = ref<boolean | null>(null)
  const needsUtensils = ref<boolean | null>(null)
  const dishHotOrCold = ref<'hot' | 'cold' | ''>('')
  const dishDescription = ref('')
  const allergen = ref('')
  /** Utensil/equipment entries when needs_utensils is true. Each entry: utensil, size, quantity. Start with one empty row. */
  const utensilEntries = ref<UtensilEntry[]>([{ utensil: '', size: '', quantity: '' }])
  /** Other-store items when foundAllIngredients is false. Each entry: item, size, quantity, additionalDetails. Start with one empty row. */
  const otherIngredientEntries = ref<OtherIngredientEntry[]>([{ item: '', size: '', quantity: '', quantityUnit: '', additionalDetails: '' }])
  /** Meat entries for bulk halal store ordering. Start with one empty row. */
  const meatEntries = ref<MeatEntry[]>([{ meatType: '', cut: '', quantity: '', quantityUnit: '', additionalDetails: '' }])

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

  /** Contacts with non-empty name and non-empty phone (numbers only, any format). */
  const validContacts = computed(() =>
    contacts.value.filter(
      (c) =>
        c.name.trim().length > 0 &&
        c.phone.trim().length > 0 &&
        isPhoneNumbersOnly(c.phone),
    ),
  )

  /** Valid phone numbers (for API payload). */
  const validPhoneNumbers = computed(() =>
    validContacts.value.map((c) => c.phone.trim()),
  )

  const canAdvancePage1 = computed(
    () =>
      !!countryCode.value &&
      (countryCode.value !== 'OTHER' || countryNameOther.value.trim().length > 0) &&
      dishName.value.trim().length > 0 &&
      validContacts.value.length > 0 &&
      ingredients.value.length > 0,
  )

  /** True if an other-ingredient row has required fields filled (item, size, quantity, quantityUnit). Details optional. */
  function isOtherIngredientRowComplete(e: OtherIngredientEntry): boolean {
    const item = String(e?.item ?? '').trim()
    const size = String(e?.size ?? '').trim()
    const quantity = String(e?.quantity ?? '').trim()
    const quantityUnit = String(e?.quantityUnit ?? '').trim()
    return item !== '' && size !== '' && quantity !== '' && quantityUnit !== ''
  }

  /** True if an other-ingredient row has some but not all required fields filled (must complete or clear). */
  function isOtherIngredientRowPartial(e: OtherIngredientEntry): boolean {
    const item = String(e?.item ?? '').trim()
    const size = String(e?.size ?? '').trim()
    const quantity = String(e?.quantity ?? '').trim()
    const quantityUnit = String(e?.quantityUnit ?? '').trim()
    const hasAny = item !== '' || size !== '' || quantity !== '' || quantityUnit !== ''
    const hasAll = item !== '' && size !== '' && quantity !== '' && quantityUnit !== ''
    return hasAny && !hasAll
  }

  /** Entries with item, size, quantity, quantityUnit filled (only these are sent as other_ingredients). */
  const validOtherIngredientEntries = computed(() =>
    otherIngredientEntries.value.filter((e) => isOtherIngredientRowComplete(e)),
  )

  /** True if any row is partially filled; user must complete or clear before saving. */
  const hasPartialOtherIngredientRows = computed(() =>
    otherIngredientEntries.value.some((e) => isOtherIngredientRowPartial(e)),
  )

  /** Derived: false if user listed any other ingredients, true otherwise. Backed by validOtherIngredientEntries. */
  const foundAllIngredients = computed<boolean>(() =>
    validOtherIngredientEntries.value.length === 0,
  )

  /** Entries with at least utensil filled (required to submit when needs_utensils is true). */
  const validUtensilEntries = computed(() =>
    utensilEntries.value.filter((e) => e.utensil.trim() !== ''),
  )

  /** True when all page-2 questions are answered except dish description (used to show Dish Description section). */
  const canShowDishDescriptionSection = computed(
    () =>
      canAdvancePage1.value &&
      (foundAllIngredients.value || validOtherIngredientEntries.value.length >= 1) &&
      hasCookingPlace.value !== null &&
      (hasCookingPlace.value !== true || cookingLocation.value.trim().length > 0) &&
      needsFridgeSpace.value !== null &&
      dishHotOrCold.value !== '' &&
      needsUtensils.value !== null &&
      (needsUtensils.value !== true || validUtensilEntries.value.length >= 1),
  )

  /** Allergen section appears as soon as user has filled dish description. */
  const canShowAllergenSection = computed(
    () =>
      canShowDishDescriptionSection.value &&
      dishDescription.value.trim().length > 0,
  )

  /** Submit enabled once allergen is filled (dish description already required to show Allergen section). */
  const canSubmit = computed(
    () =>
      canShowAllergenSection.value &&
      allergen.value.trim().length > 0,
  )

  function addOtherIngredientEntry() {
    otherIngredientEntries.value = [...otherIngredientEntries.value, { item: '', size: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
  }

  function removeOtherIngredientEntry(index: number) {
    if (otherIngredientEntries.value.length <= 1) return
    otherIngredientEntries.value = otherIngredientEntries.value.filter((_, i) => i !== index)
  }

  function addMeatEntry() {
    meatEntries.value = [...meatEntries.value, { meatType: '', cut: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
  }

  function removeMeatEntry(index: number) {
    if (meatEntries.value.length <= 1) return
    meatEntries.value = meatEntries.value.filter((_, i) => i !== index)
  }

  /** True if a meat entry row is fully filled. */
  function isMeatRowComplete(e: MeatEntry): boolean {
    return e.meatType.trim() !== '' && e.cut.trim() !== '' && e.quantity.trim() !== '' && e.quantityUnit.trim() !== ''
  }

  /** True if a meat entry row has some but not all required fields filled. */
  function isMeatRowPartial(e: MeatEntry): boolean {
    const hasAny = e.meatType.trim() !== '' || e.cut.trim() !== '' || e.quantity.trim() !== '' || e.quantityUnit.trim() !== '' || e.additionalDetails.trim() !== ''
    return hasAny && !isMeatRowComplete(e)
  }

  const validMeatEntries = computed(() =>
    meatEntries.value.filter((e) => isMeatRowComplete(e)),
  )

  const hasPartialMeatRows = computed(() =>
    meatEntries.value.some((e) => isMeatRowPartial(e)),
  )

  function addUtensilEntry() {
    utensilEntries.value = [...utensilEntries.value, { utensil: '', size: '', quantity: '' }]
  }

  function removeUtensilEntry(index: number) {
    if (utensilEntries.value.length <= 1) return
    utensilEntries.value = utensilEntries.value.filter((_, i) => i !== index)
  }

  function addContact() {
    contacts.value = [...contacts.value, { name: '', phone: '', countryCode: '' }]
  }

  function removeContact(index: number) {
    if (contacts.value.length <= 1) return
    contacts.value = contacts.value.filter((_, i) => i !== index)
  }

  function reset() {
    teamName.value = ''
    dishName.value = ''
    countryCode.value = ''
    countryNameOther.value = ''
    members.value = []
    contacts.value = [
      { name: '', phone: '', countryCode: '' },
      { name: '', phone: '', countryCode: '' },
      { name: '', phone: '', countryCode: '' },
    ]
    hasCookingPlace.value = null
    cookingLocation.value = ''
    needsFridgeSpace.value = null
    needsUtensils.value = null
    dishHotOrCold.value = ''
    dishDescription.value = ''
    allergen.value = ''
    utensilEntries.value = [{ utensil: '', size: '', quantity: '' }]
    otherIngredientEntries.value = [{ item: '', size: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
    meatEntries.value = [{ meatType: '', cut: '', quantity: '', quantityUnit: '' }]
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
    teamName.value = sub.team_name
    dishName.value = sub.dish_name
    countryCode.value = sub.country_code ?? ''
    countryNameOther.value = (sub.country_code === 'OTHER' && (sub as { country_name?: string | null }).country_name)
      ? (sub as { country_name?: string | null }).country_name ?? ''
      : ''
    members.value = [...(sub.members || [])]
    const names = sub.members || []
    const raw = (sub.phone_number ?? '').trim()
    const phones = raw ? raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean) : []
    const maxLen = Math.max(names.length, phones.length, 1)
    const zipped = Array.from({ length: maxLen }, (_, i) => ({
      name: (names[i] ?? '').trim(),
      phone: phones[i] ?? '',
      countryCode: '', // API has no per-contact country; leave empty on load
    }))
    const defaultRows = [
      { name: '', phone: '', countryCode: '' },
      { name: '', phone: '', countryCode: '' },
      { name: '', phone: '', countryCode: '' },
    ]
    contacts.value =
      zipped.length >= 3 ? zipped : [...zipped, ...defaultRows.slice(zipped.length)]
    hasCookingPlace.value = sub.has_cooking_place ?? null
    cookingLocation.value = sub.cooking_location ?? ''
    needsFridgeSpace.value = sub.needs_fridge_space ?? null
    needsUtensils.value = sub.needs_utensils ?? null
    dishHotOrCold.value = (sub.dish_temperature as 'hot' | 'cold' | '') ?? ''
    dishDescription.value = sub.dish_description ?? ''
    allergen.value = sub.allergen ?? ''
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
    if (rawOther) {
      try {
        const parsed = JSON.parse(rawOther) as unknown
        if (Array.isArray(parsed)) {
          otherIngredientEntries.value = parsed.map((row) => {
            const r = row as Record<string, unknown>
            const qRaw = String(r?.quantity ?? '').trim()
            const spaceIdx = qRaw.indexOf(' ')
            const quantity = spaceIdx >= 0 ? qRaw.slice(0, spaceIdx) : qRaw
            const quantityUnit = spaceIdx >= 0 ? qRaw.slice(spaceIdx + 1) : ''
            return {
              item: String(r?.item ?? '').trim(),
              size: String(r?.size ?? '').trim(),
              quantity,
              quantityUnit,
              additionalDetails: String(r?.additionalDetails ?? r?.additional_details ?? '').trim(),
            }
          })
          if (otherIngredientEntries.value.length === 0) {
            otherIngredientEntries.value = [{ item: '', size: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
          }
        } else {
          otherIngredientEntries.value = [{ item: rawOther, size: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
        }
      } catch (e) {
        otherIngredientEntries.value = [{ item: rawOther, size: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
      }
    } else {
      otherIngredientEntries.value = [{ item: '', size: '', quantity: '', quantityUnit: '', additionalDetails: '' }]
    }
    ingredients.value = sub.ingredients.map((item) => ({
      ingredient: mapResponseIngredient(item.ingredient),
      quantity: item.quantity,
    }))
    const rawMeat = ((sub as Record<string, unknown>).meat_items as string | undefined ?? '').trim()
    if (rawMeat) {
      try {
        const parsed = JSON.parse(rawMeat) as unknown
        if (Array.isArray(parsed)) {
          meatEntries.value = parsed.map((row) => {
            const r = row as Record<string, unknown>
            return {
              meatType: String(r?.meatType ?? r?.meat_type ?? '').trim(),
              cut: String(r?.cut ?? '').trim(),
              quantity: String(r?.quantity ?? '').trim(),
              quantityUnit: String(r?.quantityUnit ?? r?.quantity_unit ?? '').trim(),
            }
          })
          if (meatEntries.value.length === 0) {
            meatEntries.value = [{ meatType: '', cut: '', quantity: '', quantityUnit: '' }]
          }
        } else {
          meatEntries.value = [{ meatType: '', cut: '', quantity: '', quantityUnit: '' }]
        }
      } catch {
        meatEntries.value = [{ meatType: '', cut: '', quantity: '', quantityUnit: '' }]
      }
    } else {
      meatEntries.value = [{ meatType: '', cut: '', quantity: '', quantityUnit: '' }]
    }
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
    countryNameOther,
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
    dishHotOrCold,
    dishDescription,
    canShowDishDescriptionSection,
    allergen,
    canShowAllergenSection,
    needsUtensils,
    utensilEntries,
    validUtensilEntries,
    addUtensilEntry,
    removeUtensilEntry,
    otherIngredientEntries,
    validOtherIngredientEntries,
    hasPartialOtherIngredientRows,
    isOtherIngredientRowPartial,
    addOtherIngredientEntry,
    removeOtherIngredientEntry,
    meatEntries,
    validMeatEntries,
    hasPartialMeatRows,
    addMeatEntry,
    removeMeatEntry,
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
    isPhoneNumbersOnly,
  }
})
