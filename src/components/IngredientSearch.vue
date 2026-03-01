<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useIngredientSearch } from '@/composables/useIngredientSearch'
import { useSubmissionStore } from '@/stores/submission'
import type { Ingredient } from '@/types/ingredient'
import IngredientThumb from '@/components/IngredientThumb.vue'

const props = withDefaults(
  defineProps<{
    hidePrice?: boolean
    /** When set, called instead of store.addIngredient (e.g. for organizer add-to-submission) */
    addCallback?: (ingredient: Ingredient, quantity: number) => void
  }>(),
  { hidePrice: false, addCallback: undefined }
)

const { query, results, isLoading, error, clear, selectedCategory, availableCategories, setCategory } = useIngredientSearch()
const store = useSubmissionStore()

const searchWrapRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const showDropdown = computed(
  () =>
    isLoading.value ||
    !!error.value ||
    (query.value.length >= 2 && results.value.length === 0) ||
    results.value.length > 0
)

watch(showDropdown, async (visible) => {
  if (visible) {
    await nextTick()
    if (searchWrapRef.value) {
      const rect = searchWrapRef.value.getBoundingClientRect()
      dropdownStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      }
    }
  }
})

function closeDropdown() {
  clear()
}

function addAndClose(ingredient: Ingredient) {
  if (props.addCallback) {
    props.addCallback(ingredient, 1)
  } else {
    store.addIngredient(ingredient, 1)
  }
  closeDropdown()
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (
    searchWrapRef.value && !searchWrapRef.value.contains(target) &&
    (!dropdownRef.value || !dropdownRef.value.contains(target))
  ) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="searchWrapRef" class="search-wrap">
    <input
      v-model="query"
      type="text"
      placeholder="search Giant's inventory..."
      class="search-input"
      @keydown.escape="clear()"
    />

    <Teleport to="body">
      <div v-if="showDropdown" ref="dropdownRef" class="search-dropdown" :style="dropdownStyle">
      <div v-if="availableCategories.length > 1" class="search-category-bar">
        <button
          class="search-category-pill"
          :class="{ 'search-category-pill-active': !selectedCategory }"
          @mousedown.prevent="setCategory(null)"
        >All</button>
        <button
          v-for="cat in availableCategories"
          :key="cat"
          class="search-category-pill"
          :class="{ 'search-category-pill-active': selectedCategory === cat }"
          @mousedown.prevent="setCategory(cat)"
        >{{ cat }}</button>
      </div>

      <div v-if="isLoading" class="search-dropdown-msg">searching...</div>
      <div v-else-if="error" class="search-dropdown-msg search-dropdown-error">{{ error }}</div>
      <div v-else-if="query.length >= 2 && results.length === 0" class="search-dropdown-msg">
        no results for "{{ query }}"
      </div>

      <ul v-else-if="results.length" class="search-results">
        <li
          v-for="ingredient in results"
          :key="ingredient.product_id"
          class="search-result-item"
          @mousedown.prevent="addAndClose(ingredient)"
        >
          <IngredientThumb :ingredient="ingredient" />
          <div class="search-result-info">
            <div class="search-result-name truncate">{{ ingredient.name }}</div>
            <div class="search-result-size">{{ ingredient.size }}</div>
          </div>
          <div v-if="!hidePrice" class="search-result-price tabular-nums">
            ${{ (ingredient.price_cents / 100).toFixed(2) }}
          </div>
        </li>
      </ul>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.search-wrap {
  position: relative;
  width: 100%;
}
</style>

<style>
.search-input {
  width: 100%;
  background: #fff;
  border-radius: 9999px;
  padding: 0.25rem 1rem;
  min-height: 2.75rem;
  outline: none;
  border: none;
  font-size: inherit;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}

/* Results box: teleported to body, needs unscoped styles */
.search-dropdown {
  min-width: 18rem;
  max-height: 38rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  outline: none;
}

.search-dropdown-msg {
  padding: 1rem;
  font-size: 1.0625rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.search-dropdown-error {
  color: #b91c1c;
}

.search-category-bar {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  padding: 0.5rem 1rem 0.375rem;
  flex-shrink: 0;
  scrollbar-width: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.search-category-bar::-webkit-scrollbar {
  display: none;
}

.search-category-pill {
  border-radius: 9999px;
  padding: 0.1875rem 0.75rem;
  font-size: 0.9375rem;
  font-family: inherit;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  background: #fff;
  color: var(--color-lafayette-gray, #3c373c);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background-color 0.1s, color 0.1s, border-color 0.1s;
}

.search-category-pill-active {
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  border-color: var(--color-lafayette-red, #6b0f2a);
}

.search-results {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background-color 0.1s;
}

.search-result-item:hover {
  background-color: rgba(107, 15, 42, 0.08);
}

.search-result-info {
  flex: 1;
  min-width: 0;
}

.search-result-name {
  font-size: 1.125rem;
  line-height: 1.3;
}

.search-result-size {
  font-size: 1.0625rem;
  color: var(--color-lafayette-gray, #3c373c);
  line-height: 1.3;
}

.search-result-price {
  font-size: 1.0625rem;
  color: var(--color-lafayette-gray, #3c373c);
  flex: none;
}
</style>
