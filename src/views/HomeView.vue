<script setup lang="ts">
import '@/styles/form-section.css'
import { computed, defineAsyncComponent, ref, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import CountrySelect from '@/components/CountrySelect.vue'
import YesNoSelect from '@/components/YesNoSelect.vue'
import HotColdSelect from '@/components/HotColdSelect.vue'
import { TriangleAlert } from 'lucide-vue-next'
import { useSubmissionStore, OTHER_INGREDIENT_SIZE_OPTIONS, OTHER_INGREDIENT_QUANTITY_UNITS, MEAT_TYPE_OPTIONS, MEAT_CUT_OPTIONS, MEAT_QUANTITY_UNITS } from '@/stores/submission'
import { createSubmission, lookupSubmissionByPhone, updateSubmission } from '@/api/submissions'
import { useFormLockState } from '@/composables/useFormLockState'
import { hasOrganizerToken } from '@/api/organizer'
import { useIngredientCacheStore } from '@/stores/ingredientCache'

const IngredientSearch = defineAsyncComponent(
  () => import('@/components/IngredientSearch.vue')
)
const IngredientList = defineAsyncComponent(
  () => import('@/components/IngredientList.vue')
)

const store = useSubmissionStore()
const {
  members,
  ingredients,
  canAdvancePage1,
  canSubmit,
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
  otherIngredientEntries,
  validOtherIngredientEntries,
  hasPartialOtherIngredientRows,
  validPhoneNumbers,
  validContacts,
  contacts,
  countryCode,
  countryNameOther,
  dishName,
  editingSubmissionId,
  editingAsOrganizer,
} = storeToRefs(store)
const {
  meatEntries,
  validMeatEntries,
  hasPartialMeatRows,
} = storeToRefs(store)
const contactDropdownOpen = ref(false)
const contactDropdownRef = ref<HTMLElement | null>(null)
const contactTriggerRef = ref<HTMLElement | null>(null)
const contactDropdownStyle = ref<Record<string, string>>({})
const otherIngredientsDropdownOpen = ref(false)
const otherIngredientsDropdownRef = ref<HTMLElement | null>(null)
const otherIngredientsTriggerRef = ref<HTMLElement | null>(null)
const otherIngredientsDropdownStyle = ref<Record<string, string>>({})
const openPackageRowIndex = ref<number | null>(null)
const openUnitRowIndex = ref<number | null>(null)
const packageDropdownStyle = ref<Record<string, string>>({})
const unitDropdownStyle = ref<Record<string, string>>({})
const packageDropdownRef = ref<HTMLElement | null>(null)
const unitDropdownRef = ref<HTMLElement | null>(null)
const utensilsDropdownOpen = ref(false)
const utensilsDropdownRef = ref<HTMLElement | null>(null)
const utensilsTriggerRef = ref<HTMLElement | null>(null)
const utensilsDropdownStyle = ref<Record<string, string>>({})
const openMeatTypeRowIndex = ref<number | null>(null)
const openMeatCutRowIndex = ref<number | null>(null)
const openMeatUnitRowIndex = ref<number | null>(null)
const meatTypeDropdownStyle = ref<Record<string, string>>({})
const meatCutDropdownStyle = ref<Record<string, string>>({})
const meatUnitDropdownStyle = ref<Record<string, string>>({})
const meatTypeDropdownRef = ref<HTMLElement | null>(null)
const meatCutDropdownRef = ref<HTMLElement | null>(null)
const meatUnitDropdownRef = ref<HTMLElement | null>(null)
const { isResponsesLocked, hasLoadedFormLock, refreshFormLockStatus } = useFormLockState()

/** Lock the form for students only — any authenticated organizer is always allowed through. */
const shouldLockForm = computed(() => isResponsesLocked.value && !editingAsOrganizer.value && !hasOrganizerToken())

/** True only after user has clicked Save in the group info dropdown with at least one valid contact. Cleared when contacts become invalid. */
const groupInfoCommitted = ref(false)

/** At least one valid name+phone pair (for grocery section and Save button). */
const hasValidContact = computed(() => validContacts.value.length > 0)

watch(hasValidContact, (valid) => {
  if (!valid) groupInfoCommitted.value = false
})

watch(
  [editingSubmissionId, validContacts],
  () => {
    if (editingSubmissionId.value != null && validContacts.value.length > 0) {
      groupInfoCommitted.value = true
    }
  },
  { immediate: true },
)

function toggleContactDropdown() {
  contactDropdownOpen.value = !contactDropdownOpen.value
  if (contactDropdownOpen.value && contactTriggerRef.value) {
    const rect = contactTriggerRef.value.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))
    contactDropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${left}px`,
      width: `${rect.width}px`,
    }
  }
}

function normalizedConflictPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits || raw.trim()
}

function conflictMessageForPhone(raw: string): string {
  return `${normalizedConflictPhone(raw)} has already been added to another group`
}

async function hasPhoneConflictWithAnotherGroup(): Promise<boolean> {
  if (validPhoneNumbers.value.length === 0) return false
  const editingId = store.editingSubmissionId
  isCheckingPhoneConflicts.value = true
  try {
    for (const phone of validPhoneNumbers.value) {
      try {
        const { submission } = await lookupSubmissionByPhone(phone)
        if (editingId == null || submission.id !== editingId) {
          contactPhoneConflictError.value = conflictMessageForPhone(phone)
          return true
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (/submission not found/i.test(message)) continue
      }
    }
    return false
  } finally {
    isCheckingPhoneConflicts.value = false
  }
}

async function handleContactSave() {
  contactPhoneConflictError.value = null
  const hasConflict = await hasPhoneConflictWithAnotherGroup()
  if (hasConflict) {
    contactDropdownOpen.value = true
    return
  }
  if (hasValidContact.value) groupInfoCommitted.value = true
  contactDropdownOpen.value = false
}

function phoneIncompleteAt(index: number) {
  const phone = contacts.value[index]?.phone?.trim() ?? ''
  return phone.length > 0 && !store.isPhoneNumbersOnly(contacts.value[index]?.phone ?? '')
}

function handleContactClickOutside(e: MouseEvent) {
  const target = e.target as Node
  // Do not close our dropdowns when user is clicking inside a teleported select (Hot/Cold, Yes/No, Country)
  if ((target as Element).closest?.('.yes-no-select-dropdown, .hot-cold-select-dropdown, .country-select-dropdown')) {
    return
  }
  if (
    contactDropdownOpen.value &&
    contactDropdownRef.value && !contactDropdownRef.value.contains(target) &&
    contactTriggerRef.value && !contactTriggerRef.value.contains(target)
  ) {
    contactDropdownOpen.value = false
  }
  if (
    otherIngredientsDropdownOpen.value &&
    otherIngredientsDropdownRef.value && !otherIngredientsDropdownRef.value.contains(target) &&
    otherIngredientsTriggerRef.value && !otherIngredientsTriggerRef.value.contains(target)
  ) {
    otherIngredientsDropdownOpen.value = false
  }
  if (
    openPackageRowIndex.value !== null &&
    !(target as Element).closest?.('.home-other-ingredients-package-trigger') &&
    !packageDropdownRef.value?.contains(target)
  ) {
    openPackageRowIndex.value = null
  }
  if (
    openUnitRowIndex.value !== null &&
    !(target as Element).closest?.('.home-other-ingredients-unit-trigger') &&
    !unitDropdownRef.value?.contains(target)
  ) {
    openUnitRowIndex.value = null
  }
  if (
    utensilsDropdownOpen.value &&
    utensilsDropdownRef.value && !utensilsDropdownRef.value.contains(target) &&
    utensilsTriggerRef.value && !utensilsTriggerRef.value.contains(target)
  ) {
    utensilsDropdownOpen.value = false
  }
}

function toggleOtherIngredientsDropdown() {
  otherIngredientsDropdownOpen.value = !otherIngredientsDropdownOpen.value
  if (otherIngredientsDropdownOpen.value && otherIngredientsTriggerRef.value) {
    const rect = otherIngredientsTriggerRef.value.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))
    otherIngredientsDropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${left}px`,
      width: `${rect.width}px`,
    }
  }
}

function openPackageDropdown(i: number, e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  packageDropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
  }
  openPackageRowIndex.value = i
}

function selectPackage(opt: string) {
  if (openPackageRowIndex.value !== null) {
    const entry = store.otherIngredientEntries[openPackageRowIndex.value]
    if (entry) entry.size = opt
    openPackageRowIndex.value = null
  }
}

function openUnitDropdown(i: number, e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  unitDropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: `${rect.width}px`,
  }
  openUnitRowIndex.value = i
}

function selectUnit(opt: string) {
  if (openUnitRowIndex.value !== null) {
    const entry = store.otherIngredientEntries[openUnitRowIndex.value]
    if (entry) entry.quantityUnit = opt
    openUnitRowIndex.value = null
  }
}

function handleOtherIngredientsSave() {
  otherIngredientsDropdownOpen.value = false
}

function toggleUtensilsDropdown() {
  utensilsDropdownOpen.value = !utensilsDropdownOpen.value
  if (utensilsDropdownOpen.value && utensilsTriggerRef.value) {
    const rect = utensilsTriggerRef.value.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8))
    utensilsDropdownStyle.value = {
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${left}px`,
      width: `${rect.width}px`,
    }
  }
}

function handleUtensilsSave() {
  utensilsDropdownOpen.value = false
}

function openMeatTypeDropdown(i: number, e: MouseEvent) {
  if (openMeatTypeRowIndex.value === i) { openMeatTypeRowIndex.value = null; return }
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  meatTypeDropdownStyle.value = { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, minWidth: `${rect.width}px` }
  openMeatTypeRowIndex.value = i
}

function selectMeatType(opt: string) {
  if (openMeatTypeRowIndex.value !== null) {
    const entry = store.meatEntries[openMeatTypeRowIndex.value]
    if (entry) { entry.meatType = opt; entry.cut = '' }
    openMeatTypeRowIndex.value = null
  }
}

function openMeatCutDropdown(i: number, e: MouseEvent) {
  if (openMeatCutRowIndex.value === i) { openMeatCutRowIndex.value = null; return }
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  meatCutDropdownStyle.value = { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, minWidth: `${rect.width}px` }
  openMeatCutRowIndex.value = i
}

function selectMeatCut(opt: string) {
  if (openMeatCutRowIndex.value !== null) {
    const entry = store.meatEntries[openMeatCutRowIndex.value]
    if (entry) entry.cut = opt
    openMeatCutRowIndex.value = null
  }
}

function openMeatUnitDropdown(i: number, e: MouseEvent) {
  if (openMeatUnitRowIndex.value === i) { openMeatUnitRowIndex.value = null; return }
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  meatUnitDropdownStyle.value = { position: 'fixed', top: `${rect.bottom + 4}px`, left: `${rect.left}px`, minWidth: `${rect.width}px` }
  openMeatUnitRowIndex.value = i
}

function selectMeatUnit(opt: string) {
  if (openMeatUnitRowIndex.value !== null) {
    const entry = store.meatEntries[openMeatUnitRowIndex.value]
    if (entry) entry.quantityUnit = opt
    openMeatUnitRowIndex.value = null
  }
}

function meatCutOptionsForRow(i: number): readonly string[] {
  const type = store.meatEntries[i]?.meatType || ''
  return MEAT_CUT_OPTIONS[type] ?? ['', 'Other']
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void refreshFormLockStatus()
  }
}

onMounted(() => {
  useIngredientCacheStore().preload()
  document.addEventListener('click', handleContactClickOutside)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  void refreshFormLockStatus()
})
onUnmounted(() => {
  document.removeEventListener('click', handleContactClickOutside)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

const router = useRouter()

const membersText = computed({
  get: () => members.value.join(', '),
  set: (val: string) => {
    members.value = val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
})

const showGrocerySection = computed(() =>
  Boolean(countryCode.value) &&
  Boolean(dishName.value.trim()) &&
  groupInfoCommitted.value &&
  hasValidContact.value,
)

const showEditSubmissionCta = computed(() => {
  const hasAnyTypedContact = contacts.value.some((contact) =>
    Boolean((contact.name || '').trim()) || Boolean((contact.phone || '').trim()),
  )
  return !countryCode.value &&
    !dishName.value.trim() &&
    !countryNameOther.value.trim() &&
    !hasAnyTypedContact
})

const remindersExpanded = ref(true)
watch(showGrocerySection, (show) => {
  if (show) remindersExpanded.value = false
})

function goToSubmissionLookup() {
  if (shouldLockForm.value) return
  router.push({ path: '/organizer', query: { mode: 'student-edit' } })
}

// Page state: 1 = Grocery/Other/Meat sections, 2 = Additional Details
const currentPage = ref(1)

// Which collapsible section is expanded on page 1 (null = all collapsed)
const activeSection = ref<'grocery' | 'other' | 'meat' | null>('grocery')
function toggleSection(section: 'grocery' | 'other' | 'meat') {
  activeSection.value = activeSection.value === section ? null : section
}

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const contactPhoneConflictError = ref<string | null>(null)
const isCheckingPhoneConflicts = ref(false)

watch(
  contacts,
  () => {
    if (contactPhoneConflictError.value) contactPhoneConflictError.value = null
  },
  { deep: true },
)

function handleNext() {
  if (!canAdvancePage1.value || shouldLockForm.value) return
  activeSection.value = 'other'
}

function handleNextToMeat() {
  if (shouldLockForm.value || hasPartialOtherIngredientRows.value) return
  activeSection.value = 'meat'
}

function handleNextToDetails() {
  if (shouldLockForm.value || hasPartialMeatRows.value) return
  currentPage.value = 2
}

function handleBack() {
  if (currentPage.value === 2) {
    currentPage.value = 1
    activeSection.value = 'meat'
  }
  submitError.value = null
}

function handleBackToGrocery() {
  activeSection.value = 'grocery'
}

function handleBackToOther() {
  activeSection.value = 'other'
}

async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return

  if (!store.editingAsOrganizer && !hasOrganizerToken()) {
    const locked = await refreshFormLockStatus()
    if (locked) {
      submitError.value = 'Form is closed'
      return
    }
  }

  isSubmitting.value = true
  submitError.value = null
  contactPhoneConflictError.value = null

  const hasConflict = await hasPhoneConflictWithAnotherGroup()
  if (hasConflict) {
    submitError.value = contactPhoneConflictError.value ?? 'Phone number has already been added to another group'
    contactDropdownOpen.value = true
    isSubmitting.value = false
    return
  }

  const payload = {
    team_name: store.teamName || validContacts.value[0]?.name.trim() || 'Team',
    dish_name: store.dishName,
    notes: '',
    country_code: store.countryCode || '',
    ...(store.countryCode === 'OTHER' && { country_name_other: store.countryNameOther.trim() || undefined }),
    members: validContacts.value.map((c) => c.name.trim()),
    phone_number: validPhoneNumbers.value.length > 0
      ? validPhoneNumbers.value.join(', ')
      : undefined,
    has_cooking_place: hasCookingPlace.value ?? undefined,
    cooking_location: hasCookingPlace.value === true ? cookingLocation.value.trim() || undefined : undefined,
    found_all_ingredients: foundAllIngredients.value,
    // Always send other_ingredients: list when not-all-found, null when all-found so backend can save or clear (only complete rows; quantity sent as "number unit")
    other_ingredients: !foundAllIngredients.value
      ? JSON.stringify(validOtherIngredientEntries.value.map((e) => ({
          item: e.item,
          size: e.size,
          quantity: `${e.quantity} ${e.quantityUnit}`.trim(),
          additionalDetails: e.additionalDetails,
        })))
      : null,
    meat_items: validMeatEntries.value.length > 0
      ? JSON.stringify(validMeatEntries.value.map((e) => ({
          meatType: e.meatType,
          cut: e.cut,
          quantity: e.quantity,
          quantityUnit: e.quantityUnit,
        })))
      : null,
    needs_fridge_space: needsFridgeSpace.value ?? undefined,
    dish_temperature: dishHotOrCold.value || undefined,
    dish_description: (dishDescription.value || '').trim(),
    allergen: (allergen.value || '').trim(),
    needs_utensils: needsUtensils.value ?? undefined,
    utensils_notes: needsUtensils.value === true && utensilEntries.value.length > 0
      ? JSON.stringify(utensilEntries.value)
      : undefined,
    ingredients: ingredients.value.map((item) => ({
      ingredient_id: item.ingredient.id,
      quantity: item.quantity,
    })),
  }

  try {
    const editingId = store.editingSubmissionId
    if (editingId != null) {
      const result = await updateSubmission(editingId, payload)
      const asOrganizer = store.editingAsOrganizer
      store.clearEdit()
      if (asOrganizer) {
        store.setPendingOrganizerMerge(result)
        router.push('/organizer')
      } else {
        store.setLastSubmitted(result)
        router.push('/confirmation')
      }
    } else {
      const { submission } = await createSubmission(payload)
      store.reset()
      store.setLastSubmitted(submission)
      router.push('/confirmation')
    }
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Submission failed'
    if (/already been added to another group/i.test(rawMessage)) {
      const cleaned = rawMessage.replace(/^Validation failed:\s*/i, '').trim()
      submitError.value = cleaned
      contactPhoneConflictError.value = cleaned
    } else {
      submitError.value = rawMessage
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="home-view">
    <section class="home-header form-section-top-bar" aria-label="Submission form header">
      <div class="home-header-inner form-section-top-bar-inner">
        <h1 class="form-section-pill form-section-pill-label">Grocery Submission Form</h1>
      </div>
    </section>

    <!-- PAGE 1 -->
    <div v-show="currentPage === 1" class="page-wrapper" :class="{ 'form-locked': shouldLockForm }">
      <section
        class="home-reminders-section form-section-top-bar"
        aria-label="Important reminders"
        :class="{ 'home-reminders-section-collapsed': !remindersExpanded }"
      >
        <div class="home-reminders-section-inner form-section-top-bar-inner">
          <button
            type="button"
            class="form-section-pill form-section-pill-label home-reminders-toggle"
            :aria-expanded="remindersExpanded"
            @click="remindersExpanded = !remindersExpanded"
          >
            Important Reminders
            <span
              class="home-reminders-chevron"
              :class="{ 'home-reminders-chevron-open': remindersExpanded }"
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          <div v-show="remindersExpanded" class="home-reminders-section-scroll">
            <ul class="home-reminders-list">
              <li><span class="home-reminders-line">Use this form to request groceries you need to make your dish. Remember, you will be making 2-3 large trays that should be able to serve 250-300 small portions for everyone attending the event</span></li>
              <li><span class="home-reminders-line">Please <strong>SEARCH</strong> for products very thoroughly. Read the <strong>QUANTITIES</strong> and size very carefully too!</span></li>
              <li><span class="home-reminders-line">If you can't find something, don't worry. You can add those items to separate list</span></li>
              <li><span class="home-reminders-line">Please remain available on <strong>DATE</strong> around <strong>TIME</strong> so we can call you while we are shopping in case we need clarification</span></li>
              <li><span class="home-reminders-line">If you need to edit your submission, click Submissions in the top right and enter your phone number</span></li>
              <li><span class="home-reminders-line">We will provide basic equipment on the day of the event - gloves, trays, serving utensils, heating units - so please don't request those. Anything else you may need, feel free to add (pots, pans, strainers, ladles etc)</span></li>
              <li><span class="home-reminders-line">Please do not submit meat from the Giant search. There will be another section to specify what you need. We will buy it in bulk from the Halal store</span></li>
            </ul>
          </div>
        </div>
      </section>

      <div class="home-dish-bar form-section-top-bar">
        <div class="home-dish-bar-inner">
          <div class="form-section-pill form-section-pill-label">Dish Details</div>
          <div class="form-section-pill home-dish-pill home-dish-pill-country">
            <CountrySelect />
          </div>
          <div
            v-if="countryCode === 'OTHER'"
            class="form-section-pill home-dish-pill home-dish-pill-country-other"
          >
            <input
              v-model="store.countryNameOther"
              type="text"
              placeholder="Country Name"
              :size="Math.max(12, (store.countryNameOther || '').length + 1)"
              class="form-section-pill-input pill-input-center"
              aria-label="Country Name (when Other is selected)"
            />
          </div>
          <div class="form-section-pill home-dish-pill home-dish-pill-dish-name">
            <input
              v-model="store.dishName"
              type="text"
              placeholder="Dish Name"
              :size="Math.max(11, (store.dishName || '').length + 1)"
              class="form-section-pill-input pill-input-center"
            />
          </div>
          <!-- Team member names pill commented out for now
          <div class="form-section-pill home-dish-pill home-dish-pill-grow">
            <input
              v-model="membersText"
              type="text"
              placeholder="Team Member Names"
              class="form-section-pill-input pill-input-center"
            />
          </div>
          -->
          <div class="form-section-pill home-dish-pill home-dish-pill-phone home-contact-pill-wrap">
            <button
              ref="contactTriggerRef"
              type="button"
              class="home-contact-trigger"
              :class="{ 'home-contact-trigger--saved': hasValidContact }"
              :aria-expanded="contactDropdownOpen"
              aria-haspopup="dialog"
              @click="toggleContactDropdown"
            >
              {{ hasValidContact ? 'Group Info Added' : 'Add Group Info' }}
              <span
                class="home-contact-chevron"
                :class="{ 'home-contact-chevron-open': contactDropdownOpen }"
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <Teleport to="body">
              <div
                v-show="contactDropdownOpen"
                ref="contactDropdownRef"
                class="home-contact-dropdown"
                :style="contactDropdownStyle"
                role="dialog"
              >
              <div
                v-for="(contact, i) in contacts"
                :key="i"
                class="home-contact-dropdown-row"
              >
                <div class="home-contact-pill home-contact-pill-name">
                  <input
                    v-model="contact.name"
                    type="text"
                    placeholder="Name"
                    class="home-contact-input"
                  />
                </div>
                <div class="home-contact-pill home-contact-pill-country">
                  <CountrySelect v-model="contact.countryCode" compact />
                </div>
                <div class="home-contact-pill home-contact-pill-phone">
                  <span class="home-phone-pill-inner">
                    <input
                      v-model="contact.phone"
                      type="text"
                      inputmode="tel"
                      placeholder="Phone"
                      class="home-contact-input"
                      :aria-invalid="phoneIncompleteAt(i)"
                    />
                    <span
                      v-if="phoneIncompleteAt(i)"
                      class="home-phone-hazard-wrap"
                      title="Enter numbers only"
                      aria-label="Invalid phone"
                    >
                      <TriangleAlert class="home-phone-hazard" aria-hidden="true" />
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  class="home-phone-remove"
                  :aria-label="`Remove contact ${i + 1}`"
                  @click.stop="store.removeContact(i)"
                >
                  <span class="home-contact-btn-icon" aria-hidden="true">×</span>
                </button>
              </div>
              <div class="home-contact-dropdown-row home-contact-add-row-wrap">
                <span class="home-contact-add-row-spacer home-contact-add-row-spacer-name" />
                <span class="home-contact-add-row-spacer home-contact-add-row-spacer-country" />
                <span class="home-contact-add-row-spacer home-contact-add-row-spacer-phone" />
                <button
                  type="button"
                  class="home-contact-add-btn-circle"
                  aria-label="Add row"
                  @click="store.addContact()"
                >
                  <span class="home-contact-btn-icon" aria-hidden="true">+</span>
                </button>
              </div>
              <div v-if="contactPhoneConflictError" class="home-contact-error" role="alert" aria-live="polite">
                <TriangleAlert class="home-phone-hazard" aria-hidden="true" />
                <span>{{ contactPhoneConflictError }}</span>
              </div>
              <div class="home-contact-dropdown-footer">
                <button
                  type="button"
                  class="btn-pill-primary"
                  :disabled="!hasValidContact || isCheckingPhoneConflicts"
                  @click="handleContactSave"
                >
                  Save
                </button>
              </div>
              </div>
            </Teleport>
          </div>
        </div>
      </div>

      <div class="home-layout">
        <div v-if="showGrocerySection" class="home-main home-main-collapsible">

          <!-- SECTION: Grocery List (collapsible) -->
          <section
            class="form-section-ingredients home-collapsible-section"
            :class="{ 'home-collapsible-section--collapsed': activeSection !== 'grocery' }"
          >
            <div class="form-section-top-bar-inner form-section-grocery-bar home-collapsible-header">
              <div class="form-section-pill form-section-pill-label home-collapsible-toggle" @click="toggleSection('grocery')">Grocery List</div>
              <div v-if="activeSection === 'grocery'" class="form-section-pill form-section-pill-search">
                <Suspense>
                  <IngredientSearch :hide-price="true" />
                </Suspense>
              </div>
              <span v-if="activeSection !== 'grocery' && ingredients.length" class="home-collapsible-summary">{{ ingredients.length }} item(s) added</span>
              <span
                class="home-collapsible-chevron"
                :class="{ 'home-collapsible-chevron-open': activeSection === 'grocery' }"
                aria-hidden="true"
                @click="toggleSection('grocery')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </div>
            <template v-if="activeSection === 'grocery'">
              <Suspense>
                <template #default>
                  <div class="home-collapsible-body">
                    <div class="form-section-ingredients-body">
                      <IngredientList />
                    </div>
                    <div class="ingredient-list-footer">
                      <button
                        type="button"
                        class="btn-pill-primary"
                        :disabled="!canAdvancePage1"
                        @click="handleNext"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </template>
                <template #fallback>
                  <div class="ingredients-section-fallback" aria-hidden="true" />
                </template>
              </Suspense>
            </template>
          </section>

          <!-- SECTION: Other Ingredients (collapsible) -->
          <section
            class="form-section-ingredients home-collapsible-section"
            :class="{ 'home-collapsible-section--collapsed': activeSection !== 'other' }"
          >
            <div class="form-section-top-bar-inner form-section-grocery-bar home-collapsible-header">
              <div class="form-section-pill form-section-pill-label home-collapsible-toggle" @click="toggleSection('other')">Other Ingredients</div>
              <span v-if="activeSection !== 'other' && validOtherIngredientEntries.length" class="home-collapsible-summary">{{ validOtherIngredientEntries.length }} item(s) listed</span>
              <span
                class="home-collapsible-chevron"
                :class="{ 'home-collapsible-chevron-open': activeSection === 'other' }"
                aria-hidden="true"
                @click="toggleSection('other')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </div>
            <div v-if="activeSection === 'other'" class="home-collapsible-body">
              <div class="home-other-ingredients-inline-body">
                <div
                  v-for="(entry, i) in otherIngredientEntries"
                  :key="i"
                  class="home-other-ingredients-dropdown-row"
                >
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-item">
                    <input
                      v-model="entry.item"
                      type="text"
                      placeholder="Item (Pls be specific!)"
                      class="home-contact-input"
                    />
                  </div>
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-size">
                    <button
                      type="button"
                      class="home-other-ingredients-select-btn home-other-ingredients-package-trigger"
                      :class="{ 'home-other-ingredients-select-btn--placeholder': !entry.size }"
                      aria-haspopup="listbox"
                      :aria-expanded="openPackageRowIndex === i"
                      :aria-label="entry.size || 'Package'"
                      @click="openPackageDropdown(i, $event)"
                    >
                      {{ entry.size || 'Package' }}
                      <span class="home-other-ingredients-select-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                  <input
                    v-model="entry.quantity"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    class="home-contact-input home-other-ingredients-qty-input home-other-ingredients-pill-qty"
                    aria-label="Quantity amount"
                  />
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-unit">
                    <button
                      type="button"
                      class="home-other-ingredients-select-btn home-other-ingredients-unit-trigger"
                      :class="{ 'home-other-ingredients-select-btn--placeholder': !entry.quantityUnit }"
                      aria-haspopup="listbox"
                      :aria-expanded="openUnitRowIndex === i"
                      :aria-label="entry.quantityUnit || 'Unit'"
                      @click="openUnitDropdown(i, $event)"
                    >
                      {{ entry.quantityUnit || 'Unit' }}
                      <span class="home-other-ingredients-select-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-details">
                    <input
                      v-model="entry.additionalDetails"
                      type="text"
                      placeholder="Details"
                      class="home-contact-input"
                    />
                  </div>
                  <button
                    type="button"
                    class="home-phone-remove"
                    :aria-label="`Remove row ${i + 1}`"
                    @click.stop="store.removeOtherIngredientEntry(i)"
                  >
                    <span class="home-contact-btn-icon" aria-hidden="true">×</span>
                  </button>
                </div>
                <div class="home-contact-dropdown-row home-contact-add-row-wrap">
                  <span class="home-other-ingredients-add-spacer" />
                  <button
                    type="button"
                    class="home-contact-add-btn-circle"
                    aria-label="Add row"
                    @click="store.addOtherIngredientEntry()"
                  >
                    <span class="home-contact-btn-icon" aria-hidden="true">+</span>
                  </button>
                </div>
              </div>
              <Teleport to="body">
                <div
                  v-show="openPackageRowIndex !== null"
                  ref="packageDropdownRef"
                  class="country-select-dropdown"
                  :style="packageDropdownStyle"
                  role="listbox"
                  tabindex="-1"
                >
                  <button
                    v-for="opt in OTHER_INGREDIENT_SIZE_OPTIONS"
                    :key="opt || 'empty'"
                    type="button"
                    role="option"
                    class="country-select-option"
                    :aria-selected="openPackageRowIndex !== null && store.otherIngredientEntries[openPackageRowIndex]?.size === opt"
                    @click.stop="selectPackage(opt)"
                  >
                    {{ opt || 'Package' }}
                  </button>
                </div>
              </Teleport>
              <Teleport to="body">
                <div
                  v-show="openUnitRowIndex !== null"
                  ref="unitDropdownRef"
                  class="country-select-dropdown"
                  :style="unitDropdownStyle"
                  role="listbox"
                  tabindex="-1"
                >
                  <button
                    v-for="u in OTHER_INGREDIENT_QUANTITY_UNITS"
                    :key="u || 'empty'"
                    type="button"
                    role="option"
                    class="country-select-option"
                    :aria-selected="openUnitRowIndex !== null && store.otherIngredientEntries[openUnitRowIndex]?.quantityUnit === u"
                    @click.stop="selectUnit(u)"
                  >
                    {{ u || 'Unit' }}
                  </button>
                </div>
              </Teleport>
              <div class="ingredient-list-footer">
                <button type="button" class="btn-pill-secondary" @click="handleBackToGrocery">← Back</button>
                <button type="button" class="btn-pill-primary" :disabled="hasPartialOtherIngredientRows" @click="handleNextToMeat">Next →</button>
              </div>
            </div>
          </section>

          <!-- SECTION: Meat (collapsible) -->
          <section
            class="form-section-ingredients home-collapsible-section"
            :class="{ 'home-collapsible-section--collapsed': activeSection !== 'meat' }"
          >
            <div class="form-section-top-bar-inner form-section-grocery-bar home-collapsible-header">
              <div class="form-section-pill form-section-pill-label home-collapsible-toggle" @click="toggleSection('meat')">Meat</div>
              <span v-if="activeSection !== 'meat' && validMeatEntries.length" class="home-collapsible-summary">{{ validMeatEntries.length }} item(s) listed</span>
              <span
                class="home-collapsible-chevron"
                :class="{ 'home-collapsible-chevron-open': activeSection === 'meat' }"
                aria-hidden="true"
                @click="toggleSection('meat')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </div>
            <div v-if="activeSection === 'meat'" class="home-collapsible-body">
              <div class="home-other-ingredients-inline-body">
                <div
                  v-for="(entry, i) in meatEntries"
                  :key="i"
                  class="home-other-ingredients-dropdown-row"
                >
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-item">
                    <button
                      type="button"
                      class="home-other-ingredients-select-btn"
                      :class="{ 'home-other-ingredients-select-btn--placeholder': !entry.meatType }"
                      aria-haspopup="listbox"
                      :aria-expanded="openMeatTypeRowIndex === i"
                      :aria-label="entry.meatType || 'Meat Type'"
                      @click="openMeatTypeDropdown(i, $event)"
                    >
                      {{ entry.meatType || 'Meat Type' }}
                      <span class="home-other-ingredients-select-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-size">
                    <button
                      type="button"
                      class="home-other-ingredients-select-btn"
                      :class="{ 'home-other-ingredients-select-btn--placeholder': !entry.cut }"
                      aria-haspopup="listbox"
                      :aria-expanded="openMeatCutRowIndex === i"
                      :aria-label="entry.cut || 'Cut / Type'"
                      :disabled="!entry.meatType"
                      @click="openMeatCutDropdown(i, $event)"
                    >
                      {{ entry.cut || 'Cut / Type' }}
                      <span class="home-other-ingredients-select-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                  <input
                    v-model="entry.quantity"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    class="home-contact-input home-other-ingredients-qty-input home-other-ingredients-pill-qty"
                    aria-label="Quantity amount"
                  />
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-unit">
                    <button
                      type="button"
                      class="home-other-ingredients-select-btn home-other-ingredients-unit-trigger"
                      :class="{ 'home-other-ingredients-select-btn--placeholder': !entry.quantityUnit }"
                      aria-haspopup="listbox"
                      :aria-expanded="openMeatUnitRowIndex === i"
                      :aria-label="entry.quantityUnit || 'Unit'"
                      @click="openMeatUnitDropdown(i, $event)"
                    >
                      {{ entry.quantityUnit || 'Unit' }}
                      <span class="home-other-ingredients-select-chevron" aria-hidden="true">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                    </button>
                  </div>
                  <div class="home-other-ingredients-pill home-other-ingredients-pill-details">
                    <input
                      v-model="entry.additionalDetails"
                      type="text"
                      placeholder="Details"
                      class="home-contact-input"
                    />
                  </div>
                  <button
                    type="button"
                    class="home-phone-remove"
                    :aria-label="`Remove row ${i + 1}`"
                    @click.stop="store.removeMeatEntry(i)"
                  >
                    <span class="home-contact-btn-icon" aria-hidden="true">×</span>
                  </button>
                </div>
                <div class="home-contact-dropdown-row home-contact-add-row-wrap">
                  <span class="home-other-ingredients-add-spacer" />
                  <button
                    type="button"
                    class="home-contact-add-btn-circle"
                    aria-label="Add row"
                    @click="store.addMeatEntry()"
                  >
                    <span class="home-contact-btn-icon" aria-hidden="true">+</span>
                  </button>
                </div>
              </div>
              <Teleport to="body">
                <div
                  v-show="openMeatTypeRowIndex !== null"
                  ref="meatTypeDropdownRef"
                  class="country-select-dropdown"
                  :style="meatTypeDropdownStyle"
                  role="listbox"
                  tabindex="-1"
                >
                  <button
                    v-for="opt in MEAT_TYPE_OPTIONS"
                    :key="opt || 'empty'"
                    type="button"
                    role="option"
                    class="country-select-option"
                    :aria-selected="openMeatTypeRowIndex !== null && store.meatEntries[openMeatTypeRowIndex]?.meatType === opt"
                    @click.stop="selectMeatType(opt)"
                  >
                    {{ opt || 'Meat Type' }}
                  </button>
                </div>
              </Teleport>
              <Teleport to="body">
                <div
                  v-show="openMeatCutRowIndex !== null"
                  ref="meatCutDropdownRef"
                  class="country-select-dropdown"
                  :style="meatCutDropdownStyle"
                  role="listbox"
                  tabindex="-1"
                >
                  <button
                    v-for="opt in (openMeatCutRowIndex !== null ? meatCutOptionsForRow(openMeatCutRowIndex) : [])"
                    :key="opt || 'empty'"
                    type="button"
                    role="option"
                    class="country-select-option"
                    :aria-selected="openMeatCutRowIndex !== null && store.meatEntries[openMeatCutRowIndex]?.cut === opt"
                    @click.stop="selectMeatCut(opt)"
                  >
                    {{ opt || 'Cut / Type' }}
                  </button>
                </div>
              </Teleport>
              <Teleport to="body">
                <div
                  v-show="openMeatUnitRowIndex !== null"
                  ref="meatUnitDropdownRef"
                  class="country-select-dropdown"
                  :style="meatUnitDropdownStyle"
                  role="listbox"
                  tabindex="-1"
                >
                  <button
                    v-for="u in MEAT_QUANTITY_UNITS"
                    :key="u || 'empty'"
                    type="button"
                    role="option"
                    class="country-select-option"
                    :aria-selected="openMeatUnitRowIndex !== null && store.meatEntries[openMeatUnitRowIndex]?.quantityUnit === u"
                    @click.stop="selectMeatUnit(u)"
                  >
                    {{ u || 'Unit' }}
                  </button>
                </div>
              </Teleport>
              <div class="ingredient-list-footer">
                <button type="button" class="btn-pill-secondary" @click="handleBackToOther">← Back</button>
                <button type="button" class="btn-pill-primary" :disabled="hasPartialMeatRows" @click="handleNextToDetails">Next →</button>
              </div>
            </div>
          </section>

        </div>
        <div v-else-if="showEditSubmissionCta && hasLoadedFormLock" class="home-main home-edit-submission-state" aria-live="polite">
          <button
            type="button"
            class="btn-pill-primary home-edit-submission-btn"
            :disabled="shouldLockForm"
            @click="goToSubmissionLookup"
          >
            {{ shouldLockForm ? 'Form Closed' : 'Click here to edit your submission' }}
          </button>
        </div>
      </div>
    </div>

    <!-- PAGE 2 — Additional Details -->
    <div v-show="currentPage === 2" class="page-wrapper" :class="{ 'form-locked': shouldLockForm }">
      <div class="home-layout home-layout-page2">

        <!-- Scrollable content area -->
        <div class="home-main home-main-page2">

          <!-- Additional Details bar -->
          <div class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Additional Details</div>
              <div class="form-section-pill home-dish-pill">
                <YesNoSelect
                  v-model="hasCookingPlace"
                  placeholder="Do you have a kitchen"
                />
              </div>
              <div class="form-section-pill home-dish-pill">
                <YesNoSelect
                  v-model="needsUtensils"
                  placeholder="Do you need utensils/equipment?"
                />
              </div>
              <div class="form-section-pill home-dish-pill">
                <YesNoSelect
                  v-model="needsFridgeSpace"
                  placeholder="Do you need fridge space?"
                />
              </div>
              <div class="form-section-pill home-dish-pill">
                <HotColdSelect
                  v-model="dishHotOrCold"
                  placeholder="Is your dish hot or cold?"
                />
              </div>
            </div>
          </div>

          <!-- Cooking Location section (shows when hasCookingPlace answered; input if yes, message pill if no) -->
          <div v-if="hasCookingPlace !== null" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Cooking Location</div>
              <div v-if="hasCookingPlace === true" class="form-section-pill home-dish-pill">
                <input
                  v-model="cookingLocation"
                  type="text"
                  placeholder="Pls specify building + floor"
                  size="27"
                  class="form-section-pill-input pill-input-center"
                />
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                No worries! We'll assign one and notify you
              </div>
            </div>
          </div>

          <!-- Utensils / Equipment section (shows when needsUtensils answered; dropdown if yes, message pill if no) -->
          <div v-if="needsUtensils !== null" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Utensils / Equipment</div>
              <div v-if="needsUtensils === true" class="form-section-pill home-dish-pill home-dish-pill-grow home-utensils-pill-wrap">
                <button
                  ref="utensilsTriggerRef"
                  type="button"
                  class="home-contact-trigger"
                  :class="{ 'home-contact-trigger--saved': validUtensilEntries.length >= 1 }"
                  :aria-expanded="utensilsDropdownOpen"
                  aria-haspopup="dialog"
                  @click="toggleUtensilsDropdown"
                >
                  {{ validUtensilEntries.length >= 1 ? `${validUtensilEntries.length} item(s) listed` : 'What do you need? (Pot, strainer, etc)' }}
                  <span
                    class="home-contact-chevron"
                    :class="{ 'home-contact-chevron-open': utensilsDropdownOpen }"
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                <Teleport to="body">
                  <div
                    v-show="utensilsDropdownOpen"
                    ref="utensilsDropdownRef"
                    class="home-utensils-dropdown"
                    :style="utensilsDropdownStyle"
                    role="dialog"
                  >
                  <div
                    v-for="(entry, i) in utensilEntries"
                    :key="i"
                    class="home-utensils-dropdown-row"
                  >
                    <div class="home-utensils-pill home-utensils-pill-utensil">
                      <input
                        v-model="entry.utensil"
                        type="text"
                        placeholder="Utensil/Equipment needed"
                        class="home-contact-input"
                      />
                    </div>
                    <div class="home-utensils-pill home-utensils-pill-size">
                      <input
                        v-model="entry.size"
                        type="text"
                        placeholder="Size"
                        class="home-contact-input"
                      />
                    </div>
                    <div class="home-utensils-pill home-utensils-pill-qty">
                      <input
                        v-model="entry.quantity"
                        type="text"
                        placeholder="Quantity"
                        class="home-contact-input"
                      />
                    </div>
                    <button
                      type="button"
                      class="home-phone-remove"
                      :aria-label="`Remove row ${i + 1}`"
                      @click.stop="store.removeUtensilEntry(i)"
                    >
                      <span class="home-contact-btn-icon" aria-hidden="true">×</span>
                    </button>
                  </div>
                  <div class="home-contact-dropdown-row home-contact-add-row-wrap">
                    <span class="home-utensils-add-spacer" />
                    <button
                      type="button"
                      class="home-contact-add-btn-circle"
                      aria-label="Add row"
                      @click="store.addUtensilEntry()"
                    >
                      <span class="home-contact-btn-icon" aria-hidden="true">+</span>
                    </button>
                  </div>
                  <div class="home-contact-dropdown-footer">
                    <button
                      type="button"
                      class="btn-pill-primary"
                      :disabled="validUtensilEntries.length < 1"
                      @click="handleUtensilsSave"
                    >
                      Save
                    </button>
                  </div>
                  </div>
                </Teleport>
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                Thanks! Feel free to edit your form later
              </div>
            </div>
          </div>

          <!-- Fridge Space section (shows when needsFridgeSpace answered; same pattern as Cooking Location) -->
          <div v-if="needsFridgeSpace !== null" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Fridge Space</div>
              <div v-if="needsFridgeSpace === true" class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                No worries! We'll assign one and notify you
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                Thanks! Feel free to edit your form later
              </div>
            </div>
          </div>

          <!-- Dish Type section (shows when dish hot/cold is chosen) -->
          <div v-if="dishHotOrCold !== ''" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Dish Type</div>
              <div class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                <template v-if="dishHotOrCold === 'cold'">Thanks! We'll provide trays and serving utensils at the event</template>
                <template v-else>Thanks! We'll provide trays, racks, heating units, and serving utensils at the event</template>
              </div>
            </div>
          </div>

          <!-- Dish Description section (shows when all other questions answered) -->
          <div v-if="canShowDishDescriptionSection" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Dish Description</div>
              <div class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-pill-dish-description">
                <input
                  v-model="dishDescription"
                  type="text"
                  placeholder="Tell us about the dish you are cooking and why it's significant"
                  :size="Math.max(15, (dishDescription || '').length + 1)"
                  class="form-section-pill-input pill-input-center home-dish-description-input"
                />
              </div>
            </div>
          </div>

          <!-- Allergen section (shows when dish description filled; final input before Submit) -->
          <div v-if="canShowAllergenSection" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Allergen</div>
              <div class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-pill-allergen">
                <input
                  v-model="allergen"
                  type="text"
                  placeholder="Does your dish have any known allergens that you are aware of?"
                  :size="Math.max(15, (allergen || '').length + 1)"
                  class="form-section-pill-input pill-input-center home-dish-allergen-input"
                />
              </div>
            </div>
          </div>

        </div>

        <!-- Page 2 footer — always pinned at bottom -->
        <div class="home-page2-footer">
          <button
            type="button"
            class="btn-pill-primary"
            @click="handleBack"
          >
            ← Back
          </button>
          <span v-if="submitError" class="home-page2-error" role="alert" aria-live="polite">
            <TriangleAlert class="home-page2-error-icon" aria-hidden="true" />
            <span>{{ submitError }}</span>
          </span>
          <button
            v-if="(canSubmit && groupInfoCommitted) || isSubmitting"
            type="button"
            :disabled="isSubmitting"
            class="btn-pill-primary"
            @click="handleSubmit"
          >
            {{ isSubmitting ? (store.editingSubmissionId != null ? 'Updating...' : 'Submitting...') : (store.editingSubmissionId != null ? 'Update →' : 'Submit →') }}
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Page wrappers — transparent to flex layout when visible; hidden by v-show when switching pages */
.page-wrapper {
  display: contents;
}

/* ── Locked form state — disable all interaction ── */
.form-locked {
  pointer-events: none;
  user-select: none;
  opacity: 0.45;
  filter: grayscale(0.3);
}

.form-locked-banner {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  border-radius: 1rem;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

/* 1rem gap between all sections (matches gap below maroon header) */
.home-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0 1rem 1rem 1rem;
  font-size: 1.25rem;
  overflow: hidden;
}

.home-header {
  flex: none;
  width: 100%;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  box-sizing: border-box;
}

.home-header-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.75rem;
}

.home-header .form-section-pill-label {
  margin: 0;
}

.home-dish-bar {
  flex: none;
  width: 100%;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  box-sizing: border-box;
}

/* Dish bar pills only: fix height to match form-section default (2.75rem) */
.home-dish-bar .form-section-pill {
  min-height: 2.75rem;
  height: 2.75rem;
}

.home-dish-bar .form-section-pill-label,
.home-dish-bar .form-section-pill:has(.form-section-pill-input) {
  line-height: 2.5rem;
  padding: 0.25rem 1rem;
}

.home-dish-bar .form-section-pill-input {
  min-height: 2.5rem;
}

.home-dish-bar :deep(.country-select-btn) {
  min-height: 2.5rem;
  height: 2.5rem;
}

.home-dish-bar-inner {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 0.75rem;
}

.home-dish-pill {
  flex: 0 0 auto;
  box-sizing: border-box;
}

/* Dish name pill: only as wide as needed for placeholder, expands when typing */
.home-dish-bar .home-dish-pill-dish-name {
  flex: 0 1 auto;
  min-width: 9rem;
}

.home-dish-bar .home-dish-pill-dish-description {
  flex: 1 1 auto;
  min-width: 0;
}
.home-dish-bar .home-dish-description-input {
  width: 100%;
  box-sizing: border-box;
}
.home-dish-bar .home-dish-pill-allergen {
  flex: 1 1 auto;
  min-width: 0;
}
.home-dish-bar .home-dish-allergen-input {
  width: 100%;
  box-sizing: border-box;
}

.home-dish-pill-grow {
  flex: 1 1 auto;
}

.home-dish-pill-country {
  color: var(--color-lafayette-gray, #3c373c);
}

.home-dish-bar .home-dish-pill-country-other {
  flex: 0 1 auto;
  min-width: 9rem;
}

.home-dish-display-pill {
  color: #000;
  font-style: normal;
  font-weight: 500;
  text-align: center;
}

/* On phone: let Dish Type (and other thank-you) pills grow in height for multi-line text */
@media (max-width: 600px) {
  .home-dish-bar .form-section-pill.home-dish-display-pill {
    height: auto;
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    white-space: normal;
    line-height: 1.4;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

/* Contact pill: trigger only, opens dropdown. Width synced with dropdown. */
.home-contact-pill-wrap {
  position: relative;
  padding: 0;
  width: min(36rem, 95vw);
  min-width: min(36rem, 95vw);
}
.home-contact-trigger {
  width: 100%;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: var(--color-lafayette-gray, #3c373c);
  font-size: inherit;
  font-family: inherit;
  font-weight: 500;
  opacity: 0.7;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.home-contact-trigger:hover {
  opacity: 0.9;
}
.home-contact-trigger--saved {
  color: #000;
  opacity: 1;
}
.home-contact-trigger--saved:hover {
  opacity: 0.9;
}
.home-contact-trigger:focus,
.home-contact-trigger:focus-visible {
  outline: none;
}
.home-contact-chevron {
  display: inline-flex;
  color: inherit;
  opacity: 0.82;
  transition: transform 0.2s;
}
.home-contact-chevron-open {
  transform: rotate(180deg);
}

/* Dropdown content styles → see unscoped <style> block below */

/* Other ingredients pill-wrap (stays scoped — only the trigger, not the teleported dropdown) */
.home-other-ingredients-pill-wrap {
  position: relative;
  padding: 0;
  min-width: 0;
}

/* Utensils pill-wrap (stays scoped — only the trigger, not the teleported dropdown) */
.home-utensils-pill-wrap {
  position: relative;
  padding: 0;
  min-width: 0;
}

.home-layout {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  overflow: hidden;
  min-height: 0;
}

.home-layout-page2 {
  overflow: hidden;
  flex-direction: column;
}

.home-section-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-lafayette-gray, #3c373c);
  margin: 0.25rem 0 0.125rem 0;
  line-height: 1.3;
  text-align: center;
}

/* Important Reminders section — collapsible; when collapsed shows title pill like Grocery Submission Form */
.home-reminders-section {
  flex: none;
  width: 100%;
  min-width: 0;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  box-sizing: border-box;
  overflow: hidden;
}

.home-reminders-toggle {
  cursor: pointer;
  font: inherit;
  font-weight: 500;
  margin: 0;
  text-align: center;
  transition: opacity 0.15s;
}

.home-reminders-toggle:hover {
  opacity: 0.9;
}

.home-reminders-toggle:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.home-reminders-chevron {
  display: inline-flex;
  margin-left: 0.65rem;
  color: #fff;
  opacity: 0.82;
  transition: transform 0.2s;
}

.home-reminders-chevron-open {
  transform: rotate(180deg);
}

.home-reminders-section-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.home-reminders-section-scroll {
  flex: 1 1 100%;
  min-width: 0;
  overflow: visible;
}

.home-reminders-section .home-reminders-list {
  flex: 1 1 100%;
  display: block;
  margin: 0;
  padding-left: 2rem;
  line-height: 1.4;
  list-style-type: disc;
  list-style-position: outside;
  font-size: 1.4rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.9;
  text-align: left;
  width: 100%;
  min-width: 0;
}

.home-reminders-section .home-reminders-list li {
  margin-bottom: 0.5em;
  line-height: 1.4;
  display: list-item;
}

.home-reminders-section .home-reminders-line {
  white-space: normal;
}

.home-reminders-section .home-reminders-list li:last-child {
  margin-bottom: 0;
}

.home-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;
  overflow: hidden;
}

.home-edit-submission-state {
  align-items: center;
  justify-content: center;
}

.home-edit-submission-btn {
  min-height: 3.5rem;
  padding: 0.75rem 2rem;
  font-size: 1.35rem;
  font-weight: 600;
}

.home-main-page2 {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.ingredients-section-fallback {
  flex: 1;
  min-height: 0;
}

.pill-input-center {
  text-align: center;
  line-height: 2.5rem;
}

/* Page 1 footer — Next button row inside the grocery section */
.ingredient-list-footer {
  border-top: 1px solid #e0e0e0;
  padding-top: 1rem;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  flex: none;
}

/* When footer has both Back and Next, spread them apart */
.ingredient-list-footer:has(.btn-pill-secondary) {
  justify-content: space-between;
}

/* Inline body for Other Ingredients / Meat sections (not teleported dropdown) */
.home-other-ingredients-inline-body {
  overflow-y: auto;
  padding: 0.5rem 0;
}

/* Collapsible sections on page 1 */
.home-main-collapsible {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.home-collapsible-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 0.75rem;
}

.home-collapsible-section {
  transition: flex 0.25s ease;
}

.home-collapsible-section--collapsed {
  flex: none !important;
  overflow: hidden;
}

.home-collapsible-section--collapsed .home-collapsible-body,
.home-collapsible-section--collapsed .form-section-ingredients-body,
.home-collapsible-section--collapsed .ingredient-list-footer {
  display: none;
}

.home-collapsible-header {
  cursor: default;
  align-items: center;
}

.home-collapsible-toggle {
  cursor: pointer;
}

.home-collapsible-summary {
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.75;
  white-space: nowrap;
}

.home-collapsible-chevron {
  display: inline-flex;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
  transition: transform 0.2s;
  margin-left: auto;
  cursor: pointer;
}
.home-collapsible-chevron-open {
  transform: rotate(180deg);
}

/* Page 2 footer — Back on left, Submit on right */
.home-page2-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.5rem;
  flex: none;
}

.home-page2-error {
  flex: 1;
  font-size: 1rem;
  color: #b91c1c;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  text-align: center;
}

.home-page2-error-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}
</style>

<style>
/* ─── Teleported dropdown content ───────────────────────────────────────────
   These rules must be unscoped because the dropdowns are rendered via
   <Teleport to="body"> and the Vue scoped attribute is not applied there.
   ─────────────────────────────────────────────────────────────────────────── */

/* ── Group info (contact) dropdown ── */
.home-contact-dropdown {
  max-height: 22rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-sizing: border-box;
}
.home-contact-dropdown-row {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  min-width: 0;
  min-height: 2.5rem;
}
.home-contact-add-row-wrap {
  min-height: 2.5rem;
}
.home-contact-add-row-spacer {
  min-width: 0;
}
.home-contact-add-row-spacer-name {
  flex: 0 1 40%;
}
.home-contact-add-row-spacer-country {
  flex: 0 0 4.75rem;
  min-width: 4.75rem;
}
.home-contact-add-row-spacer-phone {
  flex: 1 1 55%;
}
.home-contact-pill {
  flex: 1 1 0;
  min-width: 8rem;
  display: flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid var(--color-border, #e5e5e5);
  padding: 0.25rem 0.75rem;
  background: #fff;
  overflow: visible;
}
.home-contact-pill-name {
  flex: 0 1 40%;
  min-width: 10rem;
}
.home-contact-pill-country {
  flex: 0 0 auto;
  min-width: 4.75rem;
  width: max-content;
  overflow: hidden;
  padding: 0.25rem 0.75rem;
  display: flex;
  align-items: stretch;
}
.home-contact-pill-country :deep(.country-select-wrap) {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.home-contact-pill-country :deep(.country-select-btn) {
  color: var(--color-lafayette-gray, #3c373c) !important;
}
.home-contact-pill-country :deep(.country-select-btn--placeholder) {
  opacity: 0.7;
}
.home-contact-pill-phone {
  flex: 1 1 55%;
  min-width: 12rem;
}
.home-contact-pill .home-phone-pill-inner {
  flex: 1;
  min-width: 0;
  overflow: visible;
}
.home-contact-input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  padding: 0;
  font-size: inherit;
  font-family: inherit;
  font-weight: 500;
  background: transparent;
  text-align: center;
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
}
.home-contact-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}
.home-contact-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  line-height: 1;
  text-align: center;
}
.home-contact-add-btn-circle {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.home-contact-add-btn-circle:hover {
  filter: brightness(1.1);
}
.home-contact-add-btn-circle:focus,
.home-contact-add-btn-circle:focus-visible {
  outline: none;
}
.home-contact-dropdown-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.25rem;
}
.home-contact-error {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.4rem;
  color: #b91c1c;
  font-size: 1rem;
  padding: 0 0.25rem;
}
.home-phone-remove {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.home-phone-remove .home-contact-btn-icon,
.home-contact-add-btn-circle .home-contact-btn-icon {
  font-size: inherit;
}
.home-phone-remove:hover {
  filter: brightness(1.1);
}
.home-phone-remove:focus,
.home-phone-remove:focus-visible {
  outline: none;
}
.home-phone-pill-inner {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.home-phone-hazard-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.home-phone-hazard {
  flex-shrink: 0;
  width: 1.1rem;
  height: 1.1rem;
  color: #b91c1c;
  pointer-events: none;
}

/* ── Other Ingredients dropdown ── */
.home-other-ingredients-dropdown {
  max-height: 22rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-sizing: border-box;
}
.home-other-ingredients-dropdown-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  min-height: 2.5rem;
}
.home-other-ingredients-pill {
  display: flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid var(--color-border, #e5e5e5);
  padding: 0.25rem 0.75rem;
  background: #fff;
  overflow: visible;
  min-width: 0;
  min-height: 2.5rem;
}
.home-other-ingredients-pill-item {
  flex: 1 1 28%;
  min-width: 5rem;
}
.home-other-ingredients-pill-item .home-contact-input {
  min-height: 2.5rem;
}
.home-other-ingredients-pill-size {
  flex: 0 1 15%;
  min-width: 5rem;
}
.home-other-ingredients-pill-qty {
  flex: 0 1 18%;
  min-width: 8rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.home-other-ingredients-pill-qty-only {
  flex: 0 0 auto;
  min-width: 4rem;
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 9999px;
  background: #fff;
  min-height: 2.5rem;
  padding: 0.25rem 0.75rem;
  overflow: visible;
  min-width: 0;
}
.home-other-ingredients-pill-unit {
  flex: 0 1 10%;
  min-width: 5rem;
}
.home-other-ingredients-qty-input {
  width: 3.5rem;
  min-width: 3rem;
  height: 2.5rem;
  min-height: 2.5rem;
  text-align: center;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 9999px;
  padding: 0.25rem 0.5rem;
  background: #fff;
  -moz-appearance: textfield;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
}
.home-other-ingredients-qty-input::-webkit-outer-spin-button,
.home-other-ingredients-qty-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.home-other-ingredients-qty-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}
/* Same as country-select-btn (custom dropdown trigger, not native select) */
.home-other-ingredients-select-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  width: 100%;
  min-width: 0;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: var(--color-lafayette-gray, #3c373c) !important;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  outline: none;
}
.home-other-ingredients-select-btn--placeholder {
  opacity: 0.7;
}
.home-other-ingredients-select-btn:hover {
  opacity: 0.85;
}
.home-other-ingredients-select-chevron {
  display: inline-flex;
  flex-shrink: 0;
  color: inherit;
  opacity: 0.82;
}
.home-other-ingredients-pill-qty .home-other-ingredients-select-btn {
  flex: 1;
  min-width: 0;
}
.home-other-ingredients-pill-details {
  flex: 1 1 30%;
  min-width: 5rem;
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}
.home-other-ingredients-pill-details .home-contact-input {
  min-height: 2.5rem;
}
.home-other-ingredients-add-spacer {
  flex: 1 1 0;
  min-width: 0;
}
/* ── Utensils dropdown ── */
.home-utensils-dropdown {
  max-height: 22rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-sizing: border-box;
}
.home-utensils-dropdown-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  min-height: 2.5rem;
}
.home-utensils-pill {
  display: flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid var(--color-border, #e5e5e5);
  padding: 0.25rem 0.75rem;
  background: #fff;
  overflow: visible;
  min-width: 0;
}
.home-utensils-pill-utensil {
  flex: 1 1 50%;
  min-width: 8rem;
}
.home-utensils-pill-size {
  flex: 0 1 20%;
  min-width: 4rem;
}
.home-utensils-pill-qty {
  flex: 0 1 15%;
  min-width: 3.5rem;
}
.home-utensils-add-spacer {
  flex: 1 1 0;
  min-width: 0;
}
</style>
