<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

const { query, results, isLoading, error, clear } = useIngredientSearch()
const store = useSubmissionStore()

const searchWrapRef = ref<HTMLElement | null>(null)

const showDropdown = computed(
  () =>
    isLoading.value ||
    !!error.value ||
    (query.value.length >= 2 && results.value.length === 0) ||
    results.value.length > 0
)

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
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target as Node)) {
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

    <div v-if="showDropdown" class="search-dropdown">
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
  </div>
</template>

<style scoped>
.search-wrap {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  background: #fff;
  border-radius: 9999px;
  padding: 0.25rem 1rem;
  min-height: 2.5rem;
  outline: none;
  border: none;
  font-size: inherit;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}

/* Results box: same styling as country dropdown */
.search-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  min-width: 18rem;
  max-height: 38rem;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  border-radius: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  padding: 0.25rem 0;
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

.search-results {
  list-style: none;
  margin: 0;
  padding: 0;
  -webkit-overflow-scrolling: touch;
}

/* Result items: same hover as country dropdown options */
.search-result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: background-color 0.1s;
}

.search-result-item:hover {
  background-color: rgba(145, 0, 41, 0.08);
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
