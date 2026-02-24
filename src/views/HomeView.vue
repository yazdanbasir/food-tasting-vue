<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import AppPanel from '@/components/AppPanel.vue'
import CountrySelect from '@/components/CountrySelect.vue'
import IngredientSearch from '@/components/IngredientSearch.vue'
import IngredientList from '@/components/IngredientList.vue'
import { useSubmissionStore } from '@/stores/submission'

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
</script>

<template>
  <div class="home-view">
    <div class="home-top-row">
      <section class="home-top-left" aria-label="Submission form header">
        <h1 class="home-title">Ingredient Submission Form</h1>
      </section>
      <div class="home-top-bar">
        <div class="home-top-bar-inner">
          <div class="home-top-pill">
            <CountrySelect />
          </div>
          <div class="home-top-pill">
            <input
              v-model="store.dishName"
              type="text"
              placeholder="dish name..."
              class="home-top-pill-input"
            />
          </div>
          <div class="home-top-pill">
            <input
              v-model="membersText"
              type="text"
              placeholder="members..."
              class="home-top-pill-input"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="home-layout">
      <div class="home-main">
        <div class="ingredients-section">
          <div class="home-top-bar-inner">
            <div class="home-top-pill home-top-pill-label">Which ingredients do you need?</div>
            <div class="home-top-pill home-top-pill-search">
              <IngredientSearch :hide-price="true" />
            </div>
          </div>
          <div class="ingredients-list-body">
            <IngredientList />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Single spacing unit (1rem) for left, right, bottom; no extra top since title is in top row */
.home-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 1rem 1rem 1rem;
  font-size: 1.25rem;
  overflow: hidden;
}

.home-title {
  font-size: clamp(1.5rem, 1.5rem + ((1vw - 0.48rem) * 4), 1.625rem);
  line-height: 1.3;
  color: var(--color-lafayette-gray, #3c373c);
  font-weight: 700;
  margin: 0 0 0.25rem 0;
}

.home-top-row {
  flex: none;
  display: flex;
  align-items: stretch;
  gap: 1rem;
  margin-bottom: 1rem;
}

.home-top-left {
  flex: 0 0 auto;
  width: fit-content;
  min-width: 14rem;
  display: flex;
  align-items: center;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1.5rem;
  min-height: 2.5rem;
}

.home-top-left .home-title {
  margin: 0;
  color: #000;
}

.home-top-bar {
  flex: 1;
  min-width: 0;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
}

.home-top-bar-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

/* Same pill as country: matches AppPanel title pill + CountrySelect button (size, bold, look) */
.home-top-pill {
  flex: none;
  min-width: 0;
  background: #fff;
  border-radius: 9999px;
  min-height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e5e5e5);
}

.home-top-pill:not(:has(.home-top-pill-input)):not(.home-top-pill-label) {
  padding: 0;
}

/* Top bar pills (including country) same height as input pills */
.home-top-bar .home-top-pill {
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
}

.home-top-pill:has(.home-top-pill-input),
.home-top-pill-label {
  min-width: 10rem;
  padding: 0.25rem 1rem;
  font-weight: 500;
}

/* Dish and members pills: condensed, grow with content, stay within section */
.home-top-bar .home-top-pill:has(.home-top-pill-input) {
  flex: 1 1 0;
  min-width: 5rem;
  max-width: 100%;
}

.home-top-pill-search {
  flex: 1;
  min-width: 0;
}

.home-top-pill-input {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  min-height: 2rem;
  font-size: inherit;
  font-family: inherit;
  font-weight: 500;
}

.home-top-pill-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.8;
}

.home-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  min-height: 0;
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

.ingredients-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 1.25rem 1rem;
  gap: 1.25rem;
  overflow: hidden;
}

.ingredients-list-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

</style>
