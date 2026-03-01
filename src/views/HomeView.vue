<script setup lang="ts">
import '@/styles/form-section.css'
import { computed, defineAsyncComponent, ref, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import CountrySelect from '@/components/CountrySelect.vue'
import YesNoSelect from '@/components/YesNoSelect.vue'
import { TriangleAlert } from 'lucide-vue-next'
import { useSubmissionStore } from '@/stores/submission'
import { createSubmission, updateSubmission } from '@/api/submissions'

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
  needsUtensils,
  utensilEntries,
  validUtensilEntries,
  otherIngredientEntries,
  validOtherIngredientEntries,
  validPhoneNumbers,
  validContacts,
  contacts,
  countryCode,
  dishName,
  editingSubmissionId,
} = storeToRefs(store)
const contactDropdownOpen = ref(false)
const contactDropdownRef = ref<HTMLElement | null>(null)
const contactTriggerRef = ref<HTMLElement | null>(null)
const otherIngredientsDropdownOpen = ref(false)
const otherIngredientsDropdownRef = ref<HTMLElement | null>(null)
const otherIngredientsTriggerRef = ref<HTMLElement | null>(null)
const utensilsDropdownOpen = ref(false)
const utensilsDropdownRef = ref<HTMLElement | null>(null)
const utensilsTriggerRef = ref<HTMLElement | null>(null)

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
}

function handleContactSave() {
  if (hasValidContact.value) groupInfoCommitted.value = true
  contactDropdownOpen.value = false
}

function phoneIncompleteAt(index: number) {
  const phone = contacts.value[index]?.phone?.trim() ?? ''
  return phone.length > 0 && !store.isUSPhoneNumber(contacts.value[index]?.phone ?? '')
}

function handleContactClickOutside(e: MouseEvent) {
  const target = e.target as Node
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
    utensilsDropdownOpen.value &&
    utensilsDropdownRef.value && !utensilsDropdownRef.value.contains(target) &&
    utensilsTriggerRef.value && !utensilsTriggerRef.value.contains(target)
  ) {
    utensilsDropdownOpen.value = false
  }
}

function toggleOtherIngredientsDropdown() {
  otherIngredientsDropdownOpen.value = !otherIngredientsDropdownOpen.value
}

function handleOtherIngredientsSave() {
  otherIngredientsDropdownOpen.value = false
}

function toggleUtensilsDropdown() {
  utensilsDropdownOpen.value = !utensilsDropdownOpen.value
}

function handleUtensilsSave() {
  utensilsDropdownOpen.value = false
}

onMounted(() => document.addEventListener('click', handleContactClickOutside))
onUnmounted(() => document.removeEventListener('click', handleContactClickOutside))

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

const remindersExpanded = ref(true)
watch(showGrocerySection, (show) => {
  if (show) remindersExpanded.value = false
})

// Page state: 1 = Dish Details + Grocery List, 2 = Additional Details
const currentPage = ref(1)

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

function handleNext() {
  if (!canAdvancePage1.value) return
  currentPage.value = 2
}

function handleBack() {
  currentPage.value = 1
  submitError.value = null
}

async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return

  isSubmitting.value = true
  submitError.value = null

  const payload = {
    team_name: store.teamName,
    dish_name: store.dishName,
    notes: '',
    country_code: store.countryCode || '',
    members: validContacts.value.map((c) => c.name.trim()),
    phone_number: validPhoneNumbers.value.length > 0
      ? validPhoneNumbers.value.join(', ')
      : undefined,
    has_cooking_place: hasCookingPlace.value || undefined,
    cooking_location: hasCookingPlace.value === 'yes' ? cookingLocation.value.trim() || undefined : undefined,
    found_all_ingredients: foundAllIngredients.value || undefined,
    other_ingredients: foundAllIngredients.value === 'no' && otherIngredientEntries.value.length > 0
      ? JSON.stringify(otherIngredientEntries.value)
      : undefined,
    needs_fridge_space: needsFridgeSpace.value || undefined,
    needs_utensils: needsUtensils.value || undefined,
    utensils_notes: needsUtensils.value === 'yes' && utensilEntries.value.length > 0
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
    submitError.value = err instanceof Error ? err.message : 'Submission failed'
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
    <div v-show="currentPage === 1" class="page-wrapper">
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
            <div
              v-show="contactDropdownOpen"
              ref="contactDropdownRef"
              class="home-contact-dropdown"
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
                      title="Enter a valid US phone number"
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
              <div class="home-contact-dropdown-footer">
                <button
                  type="button"
                  class="btn-pill-primary"
                  :disabled="!hasValidContact"
                  @click="handleContactSave"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="home-layout">
        <div v-if="showGrocerySection" class="home-main">
          <Suspense>
            <template #default>
              <div class="form-section-ingredients">
                <div class="form-section-top-bar-inner">
                  <div class="form-section-pill form-section-pill-label">Grocery List</div>
                  <div class="form-section-pill form-section-pill-search">
                    <IngredientSearch :hide-price="true" />
                  </div>
                </div>
                <div class="form-section-ingredients-body">
                  <IngredientList />
                </div>
                <div v-if="canAdvancePage1" class="ingredient-list-footer">
                  <button
                    type="button"
                    class="btn-pill-primary"
                    @click="handleNext"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </template>
            <template #fallback>
              <div class="form-section-ingredients">
                <div class="ingredients-section-fallback" aria-hidden="true" />
              </div>
            </template>
          </Suspense>
        </div>
      </div>
    </div>

    <!-- PAGE 2 -->
    <div v-show="currentPage === 2" class="page-wrapper">
      <div class="home-layout home-layout-page2">

        <!-- Scrollable content area -->
        <div class="home-main home-main-page2">

          <!-- Additional Details bar -->
          <div class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Additional Details</div>
              <div class="form-section-pill home-dish-pill">
                <YesNoSelect
                  v-model="foundAllIngredients"
                  placeholder="Did you find all ingredients?"
                />
              </div>
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
            </div>
          </div>

          <!-- Other Ingredients section (shows when foundAllIngredients is answered) -->
          <div v-if="foundAllIngredients !== ''" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Other Ingredients</div>
              <div v-if="foundAllIngredients === 'no'" class="form-section-pill home-dish-pill home-dish-pill-grow home-other-ingredients-pill-wrap">
                <button
                  ref="otherIngredientsTriggerRef"
                  type="button"
                  class="home-contact-trigger"
                  :class="{ 'home-contact-trigger--saved': validOtherIngredientEntries.length >= 1 }"
                  :aria-expanded="otherIngredientsDropdownOpen"
                  aria-haspopup="dialog"
                  @click="toggleOtherIngredientsDropdown"
                >
                  {{ validOtherIngredientEntries.length >= 1 ? `${validOtherIngredientEntries.length} item(s) listed` : 'List items you could not find on the previous page' }}
                  <span
                    class="home-contact-chevron"
                    :class="{ 'home-contact-chevron-open': otherIngredientsDropdownOpen }"
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
                <div
                  v-show="otherIngredientsDropdownOpen"
                  ref="otherIngredientsDropdownRef"
                  class="home-other-ingredients-dropdown"
                  role="dialog"
                >
                  <div
                    v-for="(entry, i) in otherIngredientEntries"
                    :key="i"
                    class="home-other-ingredients-dropdown-row"
                  >
                    <div class="home-other-ingredients-pill home-other-ingredients-pill-item">
                      <input
                        v-model="entry.item"
                        type="text"
                        placeholder="Item (PLEASE BE SPECIFIC!)"
                        class="home-contact-input"
                      />
                    </div>
                    <div class="home-other-ingredients-pill home-other-ingredients-pill-size">
                      <input
                        v-model="entry.size"
                        type="text"
                        placeholder="Size"
                        class="home-contact-input"
                      />
                    </div>
                    <div class="home-other-ingredients-pill home-other-ingredients-pill-qty">
                      <input
                        v-model="entry.quantity"
                        type="text"
                        placeholder="Quantity"
                        class="home-contact-input"
                      />
                    </div>
                    <div class="home-other-ingredients-pill home-other-ingredients-pill-details">
                      <input
                        v-model="entry.additionalDetails"
                        type="text"
                        placeholder="Additional Details"
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
                  <div class="home-contact-dropdown-footer">
                    <button
                      type="button"
                      class="btn-pill-primary"
                      :disabled="validOtherIngredientEntries.length < 1"
                      @click="handleOtherIngredientsSave"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                Thanks! Feel free to edit your form later if needed
              </div>
            </div>
          </div>

          <!-- Cooking Location section (shows when hasCookingPlace answered; input if yes, message pill if no) -->
          <div v-if="hasCookingPlace !== ''" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Cooking Location</div>
              <div v-if="hasCookingPlace === 'yes'" class="form-section-pill home-dish-pill">
                <input
                  v-model="cookingLocation"
                  type="text"
                  placeholder="Where? Please specify building + floor"
                  size="27"
                  class="form-section-pill-input pill-input-center"
                />
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                No worries! We will assign a kitchen and notify your group
              </div>
            </div>
          </div>

          <!-- Utensils / Equipment section (shows when needsUtensils answered; dropdown if yes, message pill if no) -->
          <div v-if="needsUtensils !== ''" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Utensils / Equipment</div>
              <div v-if="needsUtensils === 'yes'" class="form-section-pill home-dish-pill home-dish-pill-grow home-utensils-pill-wrap">
                <button
                  ref="utensilsTriggerRef"
                  type="button"
                  class="home-contact-trigger"
                  :class="{ 'home-contact-trigger--saved': validUtensilEntries.length >= 1 }"
                  :aria-expanded="utensilsDropdownOpen"
                  aria-haspopup="dialog"
                  @click="toggleUtensilsDropdown"
                >
                  {{ validUtensilEntries.length >= 1 ? `${validUtensilEntries.length} item(s) listed` : 'What do you need? (e.g. large pot, strainer, ladle)' }}
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
                <div
                  v-show="utensilsDropdownOpen"
                  ref="utensilsDropdownRef"
                  class="home-utensils-dropdown"
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
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                Thanks! Feel free to edit your form later if needed
              </div>
            </div>
          </div>

          <!-- Fridge Space section (shows when needsFridgeSpace answered; same pattern as Cooking Location) -->
          <div v-if="needsFridgeSpace !== ''" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Fridge Space</div>
              <div v-if="needsFridgeSpace === 'yes'" class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                No worries! We will assign you fridge space and notify your group
              </div>
              <div v-else class="form-section-pill home-dish-pill home-dish-pill-grow home-dish-display-pill">
                Thanks! Feel free to edit your form later if needed
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
          <span v-if="submitError" class="home-page2-error">{{ submitError }}</span>
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

.home-dish-pill-grow {
  flex: 1 1 auto;
}

.home-dish-pill-country {
  color: var(--color-lafayette-gray, #3c373c);
}

.home-dish-display-pill {
  color: #000;
  font-style: normal;
  font-weight: 500;
  text-align: center;
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
.home-contact-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  width: 100%;
  min-width: 100%;
  max-height: 22rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-sizing: border-box;
}
.home-contact-dropdown-row {
  display: flex;
  align-items: center;
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
.home-phone-remove:focus {
  outline: none;
}

/* Other ingredients dropdown (same pattern as contact, 4 pills: Item, Size, Quantity, Additional Details) */
.home-other-ingredients-pill-wrap {
  position: relative;
  padding: 0;
  min-width: 0;
}
.home-other-ingredients-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  width: 100%;
  min-width: 100%;
  max-height: 22rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
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
}
.home-other-ingredients-pill-item {
  flex: 1 1 28%;
  min-width: 5rem;
}
.home-other-ingredients-pill-size {
  flex: 0 1 15%;
  min-width: 4rem;
}
.home-other-ingredients-pill-qty {
  flex: 0 1 12%;
  min-width: 3.5rem;
}
.home-other-ingredients-pill-details {
  flex: 1 1 30%;
  min-width: 5rem;
}
.home-other-ingredients-add-spacer {
  flex: 1 1 0;
  min-width: 0;
}

/* Utensils dropdown (Utensil/Equipment, Size, Quantity) */
.home-utensils-pill-wrap {
  position: relative;
  padding: 0;
  min-width: 0;
}
.home-utensils-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  width: 100%;
  min-width: 100%;
  max-height: 22rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
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
  flex: none;
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
  text-align: center;
}
</style>
