<script setup lang="ts">
import '@/styles/form-section.css'
import { computed, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import CountrySelect from '@/components/CountrySelect.vue'
import YesNoSelect from '@/components/YesNoSelect.vue'
import { useSubmissionStore } from '@/stores/submission'

const IngredientSearch = defineAsyncComponent(
  () => import('@/components/IngredientSearch.vue')
)
const IngredientList = defineAsyncComponent(
  () => import('@/components/IngredientList.vue')
)

const store = useSubmissionStore()
const { members } = storeToRefs(store)

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
  Boolean(store.phoneNumber.trim()) &&
  (store.hasCookingPlace === 'no' ||
    (store.hasCookingPlace === 'yes' && Boolean(store.cookingLocation.trim())))
)
</script>

<template>
  <div class="home-view">
    <section class="home-header form-section-top-bar" aria-label="Submission form header">
      <div class="home-header-inner form-section-top-bar-inner">
        <h1 class="form-section-pill form-section-pill-label">Grocery Submission Form</h1>
      </div>
    </section>

    <section class="home-reminders-section form-section-top-bar" aria-label="Important reminders">
      <div class="home-reminders-section-scroll">
        <div class="home-reminders-section-inner form-section-top-bar-inner">
          <div class="form-section-pill form-section-pill-label">Important Reminders</div>
          <ul class="home-reminders-list">
            <li><span class="home-reminders-line">Use this form to request groceries you need to make your dish. Remember, you will be making 2-3 large trays that should be able to serve 250-300 people attending the event.</span></li>
            <li><span class="home-reminders-line">Please <strong>SEARCH</strong> for products very thoroughly. Read the <strong>QUANTITIES</strong> and size very carefully too!</span></li>
            <li><span class="home-reminders-line">If you can't find something, don't worry. You can add those items to separate list</span></li>
            <li><span class="home-reminders-line">Please remain available on <strong>DATE</strong> around <strong>TIME</strong> so we can call you while we are shopping in case we need clarification.</span></li>
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
            placeholder="dish name"
            size="11"
            class="form-section-pill-input pill-input-center"
          />
        </div>
        <div class="form-section-pill home-dish-pill home-dish-pill-grow">
          <input
            v-model="membersText"
            type="text"
            placeholder="who's on your team?"
            class="form-section-pill-input pill-input-center"
          />
        </div>
        <div class="form-section-pill home-dish-pill">
          <input
            v-model="store.phoneNumber"
            type="text"
            placeholder="phone number"
            size="14"
            class="form-section-pill-input pill-input-center"
          />
        </div>
        <div class="form-section-pill home-dish-pill">
          <YesNoSelect />
        </div>
        <div v-if="store.hasCookingPlace === 'yes'" class="form-section-pill home-dish-pill">
          <input
            v-model="store.cookingLocation"
            type="text"
            placeholder="where? (building + floor)"
            size="27"
            class="form-section-pill-input pill-input-center"
          />
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
</template>

<style scoped>
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

.home-section-title {
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-lafayette-gray, #3c373c);
  margin: 0.25rem 0 0.125rem 0;
  line-height: 1.3;
  text-align: center;
}

/* Important Reminders section — same style as form bars, below Grocery Submission Form */
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

.home-reminders-section-scroll {
  overflow-x: auto;
  overflow-y: hidden;
}

.home-reminders-section-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.home-reminders-section .home-reminders-list {
  flex: 1 1 100%;
  display: block;
  margin: 0;
  padding-left: 2rem;
  line-height: 1.4;
  list-style-type: disc;
  list-style-position: outside;
  font-size: 1.2rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.9;
  text-align: left;
  width: max-content;
  min-width: 100%;
}

.home-reminders-section .home-reminders-list li {
  margin-bottom: 0.25em;
  line-height: 1.4;
  display: list-item;
}

.home-reminders-section .home-reminders-line {
  white-space: nowrap;
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

.ingredients-section-fallback {
  flex: 1;
  min-height: 0;
}

.pill-input-center {
  text-align: center;
  line-height: 2.5rem;
}

</style>
