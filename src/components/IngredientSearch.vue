<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useIngredientSearch } from '@/composables/useIngredientSearch'
import { useSubmissionStore } from '@/stores/submission'
import type { Ingredient } from '@/types/ingredient'
import IngredientThumb from '@/components/IngredientThumb.vue'

const props = withDefaults(
  defineProps<{ hidePrice?: boolean }>(),
  { hidePrice: false }
)

const { query, results, isLoading, error, clear } = useIngredientSearch()
const store = useSubmissionStore()

const searchWrapRef = ref<HTMLElement | null>(null)
const selectedIngredient = ref<Ingredient | null>(null)
const quantity = ref(1)

const showDropdown = computed(
  () =>
    isLoading.value ||
    !!error.value ||
    (query.value.length >= 2 && results.value.length === 0) ||
    results.value.length > 0 ||
    !!selectedIngredient.value
)

function closeDropdown() {
  selectedIngredient.value = null
  quantity.value = 1
  clear()
}

function select(ingredient: Ingredient) {
  selectedIngredient.value = ingredient
  quantity.value = 1
}

function confirmAdd() {
  if (!selectedIngredient.value) return
  store.addIngredient(selectedIngredient.value, quantity.value)
  closeDropdown()
}

function cancelSelection() {
  selectedIngredient.value = null
  quantity.value = 1
}

function changeQty(delta: number) {
  quantity.value = Math.max(1, quantity.value + delta)
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
      :disabled="!!selectedIngredient"
      @keydown.escape="selectedIngredient ? cancelSelection() : clear()"
    />

    <div v-if="showDropdown" class="search-dropdown">
      <div v-if="isLoading" class="search-dropdown-msg">searching...</div>
      <div v-else-if="error" class="search-dropdown-msg search-dropdown-error">{{ error }}</div>
      <div v-else-if="query.length >= 2 && results.length === 0 && !selectedIngredient" class="search-dropdown-msg">
        no results for "{{ query }}"
      </div>

      <template v-else-if="selectedIngredient">
        <div class="add-product-selected">
          <IngredientThumb :ingredient="selectedIngredient" />
          <div class="add-product-selected-info min-w-0">
            <span class="truncate">{{ selectedIngredient.name }}</span>
            <span class="add-product-size">{{ selectedIngredient.size }}</span>
          </div>
          <div class="add-product-qty">
            <button
              type="button"
              class="add-product-qty-btn"
              aria-label="Decrease quantity"
              @click="changeQty(-1)"
            >
              −
            </button>
            <span class="tabular-nums add-product-qty-num">{{ quantity }}</span>
            <button
              type="button"
              class="add-product-qty-btn"
              aria-label="Increase quantity"
              @click="changeQty(1)"
            >
              +
            </button>
          </div>
          <div class="add-product-actions">
            <button type="button" class="add-product-cancel" @click="cancelSelection">
              cancel
            </button>
            <button type="button" class="add-product-add" @click="confirmAdd">
              add
            </button>
          </div>
        </div>
      </template>

      <ul v-else-if="results.length" class="search-results">
        <li
          v-for="ingredient in results"
          :key="ingredient.product_id"
          class="search-result-item"
          @mousedown.prevent="select(ingredient)"
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
  min-height: 2rem;
  outline: none;
  border: none;
  font-size: inherit;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
}

.search-input:disabled {
  opacity: 0.9;
}

/* Results box: same styling as country dropdown */
.search-dropdown {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  min-width: 18rem;
  max-height: 28rem;
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

.add-product-selected {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  flex-wrap: wrap;
}

.add-product-selected-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.add-product-size {
  font-size: 1.0625rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.add-product-qty {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.add-product-qty-btn {
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #fff;
  color: #000;
  border: 1px solid var(--color-lafayette-gray, #3c373c);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.add-product-qty-btn:hover {
  background: var(--color-lafayette-dark-blue, #006690);
  color: #fff;
  border-color: var(--color-lafayette-dark-blue, #006690);
}

.add-product-qty-num {
  min-width: 1.5rem;
  text-align: center;
}

.add-product-actions {
  display: flex;
  gap: 0.5rem;
}

.add-product-cancel,
.add-product-add {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 1.0625rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s, color 0.15s;
}

.add-product-cancel {
  background: #fff;
  color: var(--color-lafayette-gray, #3c373c);
  border: 1px solid var(--color-lafayette-gray, #3c373c);
}

.add-product-cancel:hover {
  background: var(--color-menu-gray, #e5e3e0);
}

.add-product-add {
  background: var(--color-lafayette-red, #910029);
  color: #fff;
}

.add-product-add:hover {
  background: var(--color-lafayette-dark-blue, #006690);
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
