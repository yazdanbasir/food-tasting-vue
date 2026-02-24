<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, computed } from 'vue'
import { useIngredientSearch } from '@/composables/useIngredientSearch'
import type { Ingredient } from '@/types/ingredient'
import IngredientThumb from '@/components/IngredientThumb.vue'

const props = withDefaults(
  defineProps<{ placeholder?: string; disabled?: boolean }>(),
  { placeholder: "search for an ingredient...", disabled: false }
)

const emit = defineEmits<{ add: [ingredient: Ingredient, quantity: number] }>()

const { query, results, isLoading, error, clear } = useIngredientSearch()
const selectedIngredient = ref<Ingredient | null>(null)
const quantity = ref(1)

const showDropdown = computed(() =>
  isLoading.value ||
  !!error.value ||
  (query.value.length >= 2 && results.value.length === 0) ||
  results.value.length > 0 ||
  !!selectedIngredient.value
)

function select(ingredient: Ingredient) {
  selectedIngredient.value = ingredient
  quantity.value = 1
}

function confirmAdd() {
  if (!selectedIngredient.value) return
  emit('add', selectedIngredient.value, quantity.value)
  selectedIngredient.value = null
  quantity.value = 1
  clear()
}

function cancelSelection() {
  selectedIngredient.value = null
  quantity.value = 1
}

function changeQty(delta: number) {
  quantity.value = Math.max(1, quantity.value + delta)
}
</script>

<template>
  <div class="add-product-wrap">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      class="search-input"
      :disabled="!!selectedIngredient || disabled"
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
            <span class="qty-controls">
              <button
                type="button"
                class="qty-btn"
                aria-label="Decrease quantity"
                @click="changeQty(-1)"
              >
                −
              </button>
              <span class="tabular-nums qty-num">{{ quantity }}</span>
              <button
                type="button"
                class="qty-btn"
                aria-label="Increase quantity"
                @click="changeQty(1)"
              >
                +
              </button>
            </span>
          </div>
          <div class="add-product-actions">
            <button type="button" class="add-product-cancel" @click="cancelSelection">
              cancel
            </button>
            <button type="button" class="add-product-add" :disabled="disabled" @click="confirmAdd">
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
          <div class="search-result-price tabular-nums">
            ${{ (ingredient.price_cents / 100).toFixed(2) }}
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.add-product-wrap {
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
}

.search-input:disabled {
  opacity: 0.9;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: #fff;
  border-radius: 1rem;
  box-shadow: var(--shadow-natural, 6px 6px 9px rgba(0, 0, 0, 0.2));
  overflow: hidden;
  z-index: 50;
}

.search-dropdown-msg {
  padding: 1rem;
  font-size: 0.9375rem;
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
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.add-product-qty {
  display: inline-flex;
  align-items: center;
}

.add-product-actions {
  display: flex;
  gap: 0.5rem;
}

.add-product-cancel,
.add-product-add {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.9375rem;
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
  max-height: min(24rem, 60vh);
  overflow-y: auto;
  overflow-x: hidden;
  list-style: none;
  margin: 0;
  padding: 0;
  -webkit-overflow-scrolling: touch;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-result-item:hover {
  background: var(--color-menu-gray, #e5e3e0);
}

.search-result-info {
  flex: 1;
  min-width: 0;
}

.search-result-name {
  font-size: 1rem;
  line-height: 1.3;
}

.search-result-size {
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
  line-height: 1.3;
}

.search-result-price {
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
  flex: none;
}
</style>
