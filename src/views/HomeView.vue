<script setup lang="ts">
import '@/styles/form-section.css'
import { computed, defineAsyncComponent } from 'vue'
import { storeToRefs } from 'pinia'
import CountrySelect from '@/components/CountrySelect.vue'
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
</script>

<template>
  <div class="home-view">
    <div class="home-layout">
      <div class="home-left">
        <section class="home-header" aria-label="Submission form header">
          <h1 class="home-title">Grocery Submission Form</h1>
        </section>

        <div class="home-meta-bar form-section-top-bar">
          <div class="home-meta-bar-inner">
            <div class="form-section-pill home-meta-pill">
              <CountrySelect />
            </div>
            <div class="form-section-pill home-meta-pill">
              <input
                v-model="store.dishName"
                type="text"
                placeholder="what dish are you making?"
                class="form-section-pill-input pill-input-center"
              />
            </div>
            <div class="form-section-pill home-meta-pill">
              <input
                v-model="membersText"
                type="text"
                placeholder="who's on your team?"
                class="form-section-pill-input pill-input-center"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="home-main">
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

.home-layout {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 1rem;
  overflow: hidden;
  min-height: 0;
}

.home-left {
  flex: 0 0 auto;
  width: fit-content;
  min-width: 14rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.home-header {
  flex: none;
  display: flex;
  align-items: center;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1.5rem;
  min-height: 2.5rem;
}

.home-header .home-title {
  margin: 0;
  color: #000;
}

.home-meta-bar {
  flex: none;
  width: 100%;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
}

.home-meta-bar-inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
}

.home-meta-pill {
  flex: none;
  width: 100%;
  box-sizing: border-box;
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
