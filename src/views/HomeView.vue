<script setup lang="ts">
import '@/styles/form-section.css'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import CountrySelect from '@/components/CountrySelect.vue'
import YesNoSelect from '@/components/YesNoSelect.vue'
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
  utensilsNotes,
} = storeToRefs(store)
const phoneIsValid = computed(() =>
  store.phoneNumber.trim().length === 0 ? false : store.isUSPhoneNumber(store.phoneNumber),
)
const phoneError = computed(() =>
  store.phoneNumber.trim().length > 0 && !phoneIsValid.value
    ? 'Please enter a valid US phone number (10 digits, with optional +1 country code).'
    : '',
)
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
  Boolean(store.countryCode) &&
  Boolean(store.dishName.trim()) &&
  members.value.length > 0 &&
  phoneIsValid.value,
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
    members: [...members.value],
    phone_number: store.phoneNumber?.trim() || undefined,
    has_cooking_place: hasCookingPlace.value || undefined,
    cooking_location: hasCookingPlace.value === 'yes' ? cookingLocation.value.trim() || undefined : undefined,
    found_all_ingredients: foundAllIngredients.value || undefined,
    needs_fridge_space: needsFridgeSpace.value || undefined,
    needs_utensils: needsUtensils.value || undefined,
    utensils_notes: needsUtensils.value === 'yes' ? utensilsNotes.value.trim() || undefined : undefined,
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
          <div class="form-section-pill home-dish-pill">
            <input
              v-model="store.dishName"
              type="text"
              placeholder="Dish Name"
              size="11"
              class="form-section-pill-input pill-input-center"
            />
          </div>
          <div class="form-section-pill home-dish-pill home-dish-pill-grow">
            <input
              v-model="membersText"
              type="text"
              placeholder="Team Member Names"
              class="form-section-pill-input pill-input-center"
            />
          </div>
          <div class="form-section-pill home-dish-pill home-dish-pill-phone">
            <input
              v-model="store.phoneNumber"
              type="text"
              inputmode="tel"
              placeholder="Phone Number"
              size="14"
              class="form-section-pill-input pill-input-center"
              :aria-invalid="!!phoneError"
            />
            <p v-if="phoneError" class="home-field-error">
              {{ phoneError }}
            </p>
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

          <!-- Other Ingredients section (shows if foundAllIngredients = 'no') -->
          <div v-if="foundAllIngredients === 'no'" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Other Ingredients</div>
            </div>
          </div>

          <!-- Cooking Location section (shows if hasCookingPlace = 'yes') -->
          <div v-if="hasCookingPlace === 'yes'" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Cooking Location</div>
              <div class="form-section-pill home-dish-pill">
                <input
                  v-model="cookingLocation"
                  type="text"
                  placeholder="Where? Please specify building + floor"
                  size="27"
                  class="form-section-pill-input pill-input-center"
                />
              </div>
            </div>
          </div>

          <!-- Utensils / Equipment section (shows if needsUtensils = 'yes') -->
          <div v-if="needsUtensils === 'yes'" class="home-dish-bar form-section-top-bar">
            <div class="home-dish-bar-inner">
              <div class="form-section-pill form-section-pill-label">Utensils / Equipment</div>
              <div class="form-section-pill home-dish-pill home-dish-pill-grow">
                <input
                  v-model="utensilsNotes"
                  type="text"
                  placeholder="What do you need? (e.g. large pot, strainer, ladle)"
                  class="form-section-pill-input pill-input-center"
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
          <span v-if="submitError" class="home-page2-error">{{ submitError }}</span>
          <button
            v-if="canSubmit || isSubmitting"
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

/* Dish details bar: full width, horizontal pill row */
.home-dish-bar {
  flex: none;
  width: 100%;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  box-sizing: border-box;
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

.home-dish-pill-grow {
  flex: 1 1 auto;
}

.home-dish-pill-country {
  color: var(--color-lafayette-gray, #3c373c);
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
  font-weight: 700;
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
