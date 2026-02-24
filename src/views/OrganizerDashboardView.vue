<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createConsumer } from '@rails/actioncable'
import IngredientThumb from '@/components/IngredientThumb.vue'
import IngredientRow from '@/components/IngredientRow.vue'
import IngredientSearch from '@/components/IngredientSearch.vue'
import DietaryIcons from '@/components/DietaryIcons.vue'
import { getAllSubmissions, type SubmissionResponse } from '@/api/submissions'
import { getGroceryList, checkGroceryItem, updateGroceryQuantity, addGroceryItem, addSubmissionIngredient, updateSubmissionIngredientQuantity, deleteSubmission, type GroceryListResponse, type GroceryItem } from '@/api/organizer'
import OrganizerAddProduct from '@/components/OrganizerAddProduct.vue'
import LockOverlay from '@/components/LockOverlay.vue'
import { flagEmoji } from '@/data/countries'
import { useSubmissionStore } from '@/stores/submission'
import type { Ingredient, IngredientDietary } from '@/types/ingredient'

const router = useRouter()
const submissionStore = useSubmissionStore()

/** Map API ingredient to frontend Ingredient for IngredientRow */
function toIngredient(raw: SubmissionResponse['ingredients'][0]['ingredient']): Ingredient {
  return {
    id: raw.id,
    product_id: raw.product_id,
    name: raw.name,
    size: raw.size,
    aisle: raw.aisle,
    price_cents: raw.price_cents,
    image_url: raw.image_url,
    dietary: raw.dietary,
    price: raw.price_cents / 100,
    category: null,
  }
}

/** Aggregate dietary flags for a submission: true if any ingredient has that flag */
function aggregateDietary(sub: SubmissionResponse): IngredientDietary {
  const keys = [
    'is_alcohol', 'gluten', 'dairy', 'egg', 'peanut',
    'kosher', 'vegan', 'vegetarian', 'lactose_free', 'wheat_free',
  ] as const
  const out = {} as IngredientDietary
  for (const k of keys) {
    out[k] = sub.ingredients.some((item) => item.ingredient.dietary?.[k])
  }
  return out
}


const activeTab = ref<'submissions' | 'grocery'>('submissions')
const submissions = ref<SubmissionResponse[]>([])
const groceryList = ref<GroceryListResponse | null>(null)
const expandedSubmissions = ref<Set<number>>(new Set())

function toggleSubmissionExpanded(id: number) {
  const next = new Set(expandedSubmissions.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedSubmissions.value = next
}
const isLoading = ref(false)
const error = ref<string | null>(null)
const addProductError = ref<string | null>(null)
const addProductLoading = ref(false)

// Action Cable consumer
const cable = createConsumer(`${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')}/cable`)
let grocerySubscription: ReturnType<typeof cable.subscriptions.create> | null = null

onMounted(async () => {
  await loadSubmissions()

  // Subscribe to real-time grocery list updates
  grocerySubscription = cable.subscriptions.create('GroceryListChannel', {
    received(data: { ingredient_id: number; checked: boolean; checked_by: string | null; checked_at: string | null }) {
      if (!groceryList.value) return
      for (const items of Object.values(groceryList.value.aisles)) {
        const item = items.find((i) => i.ingredient.id === data.ingredient_id)
        if (item) {
          item.checked = data.checked
          item.checked_by = data.checked_by
          item.checked_at = data.checked_at
          break
        }
      }
    },
  })

  // Subscribe to submission notifications
  cable.subscriptions.create('NotificationsChannel', {
    received() {
      loadSubmissions()
      if (groceryList.value) loadGroceryList()
    },
  })
})

onUnmounted(() => {
  cable.disconnect()
})

async function loadSubmissions() {
  isLoading.value = true
  error.value = null
  try {
    submissions.value = await getAllSubmissions()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

async function loadGroceryList() {
  isLoading.value = true
  error.value = null
  try {
    groceryList.value = await getGroceryList()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

async function switchToGrocery() {
  activeTab.value = 'grocery'
  addProductError.value = null
  if (!groceryList.value) await loadGroceryList()
}

async function toggleCheck(item: GroceryItem) {
  const newChecked = !item.checked
  item.checked = newChecked
  try {
    await checkGroceryItem(item.ingredient.id, newChecked)
  } catch {
    item.checked = !newChecked
  }
}

async function changeQuantity(item: GroceryItem, delta: number) {
  const newQty = Math.max(1, item.total_quantity + delta)
  const prev = item.total_quantity
  item.total_quantity = newQty
  try {
    await updateGroceryQuantity(item.ingredient.id, newQty)
  } catch {
    item.total_quantity = prev
  }
}

async function handleAddToGrocery(ingredient: Ingredient, quantity: number) {
  addProductError.value = null
  addProductLoading.value = true
  try {
    await addGroceryItem(ingredient.id, quantity)
    await loadGroceryList()
  } catch (err) {
    addProductError.value = err instanceof Error ? err.message : 'Failed to add item'
  } finally {
    addProductLoading.value = false
  }
}

async function handleAddToSubmission(submissionId: number, ingredient: Ingredient, quantity: number) {
  addProductError.value = null
  addProductLoading.value = true
  try {
    await addSubmissionIngredient(submissionId, ingredient.id, quantity)
    await loadSubmissions()
  } catch (err) {
    addProductError.value = err instanceof Error ? err.message : 'Failed to add ingredient'
  } finally {
    addProductLoading.value = false
  }
}

async function handleSubmissionIngredientQty(
  submissionId: number,
  ingredientId: number,
  currentQty: number,
  delta: number,
) {
  const newQty = Math.max(0, currentQty + delta)
  addProductError.value = null
  try {
    await updateSubmissionIngredientQuantity(submissionId, ingredientId, newQty)
    await loadSubmissions()
  } catch (err) {
    addProductError.value = err instanceof Error ? err.message : 'Failed to update quantity'
  }
}

function formatAisleTitle(aisle: string): string {
  if (!aisle || aisle === 'Other' || aisle === 'Unknown') return 'Aisle Unknown'
  return `Aisle ${aisle}`
}

function handleEditSubmission(sub: SubmissionResponse) {
  submissionStore.loadForEdit(sub)
  router.push('/')
}

async function handleDeleteSubmission(sub: SubmissionResponse) {
  if (!confirm(`Delete submission “${sub.dish_name}”? This cannot be undone.`)) return
  addProductError.value = null
  try {
    await deleteSubmission(sub.id)
    expandedSubmissions.value = new Set([...expandedSubmissions.value].filter((id) => id !== sub.id))
    await loadSubmissions()
    if (groceryList.value) await loadGroceryList()
  } catch (err) {
    addProductError.value = err instanceof Error ? err.message : 'Failed to delete submission'
  }
}


const totalCents = computed(() => {
  if (!groceryList.value) return 0
  return groceryList.value.total_cents
})
</script>

<template>
  <LockOverlay>
  <div class="h-full flex flex-col dashboard">
    <!-- Subtab bar: Dishes | Grocery List (only one active at a time) -->
    <div class="dashboard-subtab-bar">
      <div class="dashboard-subtab-row">
        <button
          type="button"
          class="dashboard-subtab"
          :class="activeTab === 'submissions' ? 'dashboard-subtab-active' : 'dashboard-subtab-inactive'"
          @click="activeTab = 'submissions'; addProductError = null"
        >
          Dishes
        </button>
        <button
          type="button"
          class="dashboard-subtab"
          :class="activeTab === 'grocery' ? 'dashboard-subtab-active' : 'dashboard-subtab-inactive'"
          @click="switchToGrocery"
        >
          Grocery List
        </button>
      </div>
    </div>

    <!-- Body -->
    <div class="dashboard-body">
      <div v-if="isLoading && !submissions.length && !groceryList" class="dashboard-empty">
        loading...
      </div>
      <div v-else-if="error" class="dashboard-error">{{ error }}</div>

      <!-- Submissions Tab -->
      <div v-else-if="activeTab === 'submissions'">
        <div v-if="!submissions.length" class="dashboard-empty">No submissions yet.</div>
        <div v-else class="submissions-list">
          <div
            v-for="sub in submissions"
            :key="sub.id"
            class="submission-card"
          >
            <button
              type="button"
              class="submission-row"
              @click="toggleSubmissionExpanded(sub.id)"
            >
              <span class="submission-flag" :title="sub.country_code || ''">{{ (sub.country_code && flagEmoji(sub.country_code)) || '—' }}</span>
              <span class="submission-dish truncate">{{ sub.dish_name }}</span>
              <span class="submission-members truncate">{{ (sub.members || []).join(', ') }}</span>
              <span class="submission-dietary">
                <DietaryIcons :dietary="aggregateDietary(sub)" :size="16" />
              </span>
              <span class="submission-count tabular-nums">{{ sub.ingredients.length }} item{{ sub.ingredients.length !== 1 ? 's' : '' }}</span>
              <span class="submission-date tabular-nums">{{ new Date(sub.submitted_at).toLocaleDateString() }}</span>
              <span class="submission-expand">{{ expandedSubmissions.has(sub.id) ? '▲' : '▼' }}</span>
            </button>

            <div v-if="expandedSubmissions.has(sub.id)" class="submission-detail">
              <div class="form-section-ingredients submission-detail-ingredients">
                <div class="form-section-top-bar-inner">
                  <div class="form-section-pill form-section-pill-label">Items in this dish</div>
                  <div class="form-section-pill form-section-pill-search">
                    <IngredientSearch
                      :hide-price="true"
                      :add-callback="(ing, qty) => handleAddToSubmission(sub.id, ing, qty)"
                    />
                  </div>
                </div>
                <div class="submission-detail-list">
                  <IngredientRow
                    v-for="item in sub.ingredients"
                    :key="item.ingredient.product_id"
                    :ingredient="toIngredient(item.ingredient)"
                    :quantity="item.quantity"
                    :editable="true"
                    :show-price="true"
                    @change-qty="(delta) => handleSubmissionIngredientQty(sub.id, item.ingredient.id, item.quantity, delta)"
                  />
                </div>
              </div>
              <div v-if="addProductError && expandedSubmissions.has(sub.id)" class="dashboard-error add-product-err">
                {{ addProductError }}
              </div>
              <div v-if="sub.notes" class="submission-notes">{{ sub.notes }}</div>
              <div class="submission-detail-actions">
                <div class="submission-detail-buttons">
                  <button
                    type="button"
                    class="btn-pill-primary"
                    @click.stop="handleEditSubmission(sub)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="btn-pill-secondary btn-pill-danger"
                    @click.stop="handleDeleteSubmission(sub)"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grocery List Tab -->
      <div v-else-if="activeTab === 'grocery' && groceryList">
        <div class="grocery-add-product">
          <OrganizerAddProduct
            placeholder="add product to grocery list..."
            :disabled="addProductLoading"
            @add="handleAddToGrocery"
          />
        </div>
        <div v-if="addProductError" class="dashboard-error add-product-err">{{ addProductError }}</div>
        <div class="grocery-sections">
          <section v-for="(items, aisle) in groceryList.aisles" :key="aisle" class="grocery-aisle">
            <h2 class="grocery-aisle-title">{{ formatAisleTitle(aisle) }}</h2>
            <div class="grocery-items">
              <div
                v-for="item in items"
                :key="item.ingredient.id"
                class="grocery-row"
                :class="item.checked ? 'grocery-row-checked' : ''"
              >
                <label class="grocery-cell grocery-cell-checkbox">
                  <input
                    type="checkbox"
                    :checked="item.checked"
                    class="grocery-checkbox"
                    @change="toggleCheck(item)"
                  />
                </label>
                <div class="grocery-cell grocery-cell-thumb">
                  <IngredientThumb :ingredient="item.ingredient" />
                </div>
                <div class="grocery-cell grocery-cell-name min-w-0">
                  <span class="grocery-name truncate" :class="item.checked ? 'line-through' : ''">{{ item.ingredient.name }}</span>
                  <span class="grocery-size" :class="item.checked ? 'line-through' : ''">{{ item.ingredient.size }}</span>
                </div>
                <div class="grocery-cell grocery-cell-teams truncate" :title="item.teams.join(', ')">
                  <span class="grocery-teams">{{ item.teams.join(', ') }}</span>
                </div>
                <div class="grocery-cell grocery-cell-price tabular-nums text-right">
                  ${{ ((item.ingredient.price_cents * item.total_quantity) / 100).toFixed(2) }}
                </div>
                <div class="grocery-cell grocery-cell-qty">
                  <span class="qty-controls">
                    <button
                      type="button"
                      class="qty-btn"
                      aria-label="Decrease quantity"
                      @click.prevent.stop="changeQuantity(item, -1)"
                    >−</button>
                    <span class="tabular-nums qty-num">{{ item.total_quantity }}</span>
                    <button
                      type="button"
                      class="qty-btn"
                      aria-label="Increase quantity"
                      @click.prevent.stop="changeQuantity(item, +1)"
                    >+</button>
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="grocery-total">
          <span>Estimated total</span>
          <span class="tabular-nums">${{ (totalCents / 100).toFixed(2) }}</span>
        </div>
      </div>
    </div>
  </div>
  </LockOverlay>
</template>

<style scoped>
.dashboard {
  font-size: var(--body-font-size, 1.125rem);
}

/* Subtab bar: same pill style as main nav but smaller, clearly secondary */
.dashboard-subtab-bar {
  flex: none;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
  background: rgba(255, 255, 255, 0.6);
}

.dashboard-subtab-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-subtab {
  border-radius: 9999px;
  padding: 0.375rem 1.125rem;
  min-height: 2.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: background-color 0.15s, color 0.15s;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dashboard-subtab-active {
  background-color: #fff;
  color: var(--color-lafayette-red, #910029);
  border-color: var(--color-lafayette-red, #910029);
}

.dashboard-subtab-active:hover {
  background-color: #fff;
  color: var(--color-lafayette-red, #910029);
}

.dashboard-subtab-active:focus-visible {
  outline: 2px solid var(--color-lafayette-red, #910029);
  outline-offset: 2px;
}

.dashboard-subtab-inactive {
  background-color: transparent;
  color: var(--color-lafayette-gray, #3c373c);
}

.dashboard-subtab-inactive:hover {
  background-color: rgba(145, 0, 41, 0.08);
  color: var(--color-lafayette-red, #910029);
}

.dashboard-subtab-inactive:focus-visible {
  outline: 2px solid var(--color-lafayette-gray, #3c373c);
  outline-offset: 2px;
}


.dashboard-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  min-height: 0;
}

.dashboard-empty,
.dashboard-error {
  font-size: 1rem;
}

.dashboard-error {
  color: #b91c1c;
}

/* Submissions: card + grid row */
.submissions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.submission-card {
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  overflow: visible;
  box-shadow: var(--shadow-natural, 6px 6px 9px rgba(0, 0, 0, 0.2));
}

.submission-row {
  width: 100%;
  display: grid;
  grid-template-columns: 3.5rem minmax(8rem, 1fr) minmax(8rem, 1fr) minmax(7rem, auto) 6rem 6.5rem 2rem;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  border: none;
  background: none;
  font-size: inherit;
  transition: opacity 0.15s;
}

.submission-row:hover {
  opacity: 0.85;
}

.submission-row:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}

.submission-flag {
  font-size: 1.75rem;
  line-height: 1;
  flex-shrink: 0;
  min-width: 3.5rem;
  text-align: center;
  display: inline-block;
}

.submission-dish {
  font-weight: 600;
  min-width: 0;
}

.submission-members {
  font-style: italic;
  color: var(--color-lafayette-gray, #3c373c);
  min-width: 0;
}

.submission-dietary {
  display: flex;
  align-items: center;
  min-width: 0;
}

.submission-count {
  color: var(--color-lafayette-gray, #3c373c);
  text-align: right;
}

.submission-date {
  color: var(--color-lafayette-gray, #3c373c);
  text-align: right;
}

.submission-expand {
  color: var(--color-lafayette-gray, #3c373c);
  text-align: center;
  justify-self: center;
}

.submission-detail {
  padding: 0 1rem 1rem;
}

.submission-detail-ingredients {
  flex: none;
  min-height: 0;
}

.submission-detail-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.submission-detail-actions {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: none;
}

.submission-detail-actions .submission-detail-buttons {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 1rem;
}

.submission-notes {
  margin-top: 0.75rem;
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
  font-style: italic;
}

/* Grocery: aisle + grid rows */
.grocery-sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.grocery-aisle-title {
  font-size: clamp(1.25rem, 1.25rem + ((1vw - 0.48rem) * 0.5), 1.5rem);
  font-weight: 700;
  color: var(--color-lafayette-gray, #3c373c);
  margin: 0 0 0.5rem 0;
}

.grocery-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.grocery-row {
  display: grid;
  grid-template-columns: auto 2.5rem 1fr 10rem 5.5rem auto;
  gap: 1rem;
  align-items: center;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  transition: opacity 0.15s;
}

.grocery-cell-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.grocery-row-checked {
  opacity: 0.6;
}

.grocery-cell-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.grocery-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: var(--color-lafayette-red, #910029);
}

.grocery-cell-name {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.grocery-name {
  font-weight: 500;
}

.grocery-size {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.grocery-cell-qty {
  display: flex;
  justify-content: center;
}

.grocery-teams {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grocery-total {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-lafayette-gray, #3c373c);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.125rem;
  font-weight: 600;
}

.grocery-add-product {
  margin-bottom: 1rem;
}

.add-product-err {
  margin-top: 0.5rem;
}
</style>
