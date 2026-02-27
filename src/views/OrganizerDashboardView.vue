<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createConsumer } from '@rails/actioncable'
import IngredientThumb from '@/components/IngredientThumb.vue'
import IngredientRow from '@/components/IngredientRow.vue'
import DietaryIcons from '@/components/DietaryIcons.vue'
import { getAllSubmissions, type SubmissionResponse } from '@/api/submissions'
import { getGroceryList, checkGroceryItem, updateGroceryQuantity, updateSubmissionIngredientQuantity, deleteSubmission, updateKitchenAllocation, type GroceryListResponse, type GroceryItem, type KitchenAllocationPayload } from '@/api/organizer'
import LockOverlay from '@/components/LockOverlay.vue'
import { COUNTRIES, flagEmoji } from '@/data/countries'
import { useSubmissionStore } from '@/stores/submission'
import { useNotificationStore } from '@/stores/notifications'
import type { NotificationItem } from '@/api/notifications'
import type { Ingredient, IngredientDietary } from '@/types/ingredient'

const router = useRouter()
const submissionStore = useSubmissionStore()
const notifStore = useNotificationStore()

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


const activeTab = ref<'submissions' | 'grocery' | 'notifications'>('submissions')
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

// Action Cable consumer
const cable = createConsumer(`${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')}/cable`)
onMounted(async () => {
  await loadSubmissions()
  notifStore.load()

  // Subscribe to real-time grocery list updates
  cable.subscriptions.create('GroceryListChannel', {
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
    received(data: { notification?: NotificationItem }) {
      loadSubmissions()
      if (groceryList.value) loadGroceryList()
      if (data.notification) notifStore.addFromCable(data.notification)
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

function switchToNotifications() {
  activeTab.value = 'notifications'
  addProductError.value = null
  notifStore.load()
}


function notifRelativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

function notifDotColor(eventType: string): string {
  if (eventType === 'new_submission' || eventType === 'grocery_item_added') return '#059669'
  if (eventType === 'submission_deleted' || eventType === 'ingredient_removed') return '#dc2626'
  return '#006690'
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

function countryLabel(code: string | null): string {
  if (!code) return 'country'
  const c = COUNTRIES.find((x) => x.code === code)
  return c ? `${flagEmoji(c.code)} ${c.name}` : 'country'
}

function handleEditSubmission(sub: SubmissionResponse) {
  submissionStore.loadForEdit(sub, true)
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

// ─── Kitchen table ────────────────────────────────────────────────────────


const kitchenEditing = ref<Record<string, string>>({})
const kitchenSaveError = ref<string | null>(null)

function kitchenKey(id: number, field: string) { return `${id}:${field}` }
function isKitchenEditing(id: number, field: string) { return kitchenKey(id, field) in kitchenEditing.value }
function startKitchenEdit(id: number, field: string, val: string | null | undefined) {
  kitchenEditing.value[kitchenKey(id, field)] = val ?? ''
}
function cancelKitchenEdit(id: number, field: string) {
  const next = { ...kitchenEditing.value }
  delete next[kitchenKey(id, field)]
  kitchenEditing.value = next
}

async function saveKitchenField(
  sub: SubmissionResponse,
  field: 'cooking_location' | 'equipment_allocated' | 'helper_driver_needed',
) {
  const key = kitchenKey(sub.id, field)
  const newValue = kitchenEditing.value[key]
  if (newValue === undefined) return
  const subInList = submissions.value.find(s => s.id === sub.id)
  const prev = subInList ? (subInList as Record<string, unknown>)[field] : undefined
  if (subInList) (subInList as Record<string, unknown>)[field] = newValue || null
  cancelKitchenEdit(sub.id, field)
  kitchenSaveError.value = null
  try {
    const updated = await updateKitchenAllocation(sub.id, { [field]: newValue } as KitchenAllocationPayload)
    const idx = submissions.value.findIndex(s => s.id === updated.id)
    if (idx !== -1) submissions.value[idx] = updated
  } catch (err) {
    if (subInList) (subInList as Record<string, unknown>)[field] = prev
    kitchenSaveError.value = err instanceof Error ? err.message : 'Save failed'
  }
}

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
          Submissions
        </button>
        <button
          type="button"
          class="dashboard-subtab"
          :class="activeTab === 'grocery' ? 'dashboard-subtab-active' : 'dashboard-subtab-inactive'"
          @click="switchToGrocery"
        >
          Grocery List
        </button>
        <button
          type="button"
          class="dashboard-subtab"
          :class="activeTab === 'notifications' ? 'dashboard-subtab-active' : 'dashboard-subtab-inactive'"
          @click="switchToNotifications"
        >
          Notifications
          <span v-if="notifStore.unreadCount > 0" class="dashboard-notif-badge">{{ notifStore.unreadCount > 9 ? '9+' : notifStore.unreadCount }}</span>
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
      <div v-else-if="activeTab === 'submissions'" class="kitchen-tab">

        <div v-if="kitchenSaveError" class="kitchen-save-error">{{ kitchenSaveError }}</div>

        <div v-if="!submissions.length" class="dashboard-empty">No submissions yet.</div>
        <div v-else class="submissions-scroll-wrap">

          <!-- Column header row — 8-col grid matching data rows exactly -->
          <div class="submission-table-header">
            <div class="sub-header-cell sub-header-center">Country &amp; Dish</div>
            <div class="sub-header-cell sub-header-center">Members</div>
            <div class="sub-header-cell sub-header-center">Equip. Requested</div>
            <div class="sub-header-cell sub-header-center">Equip. Allocated ✎</div>
            <div class="sub-header-cell sub-header-center">Kitchen / Location ✎</div>
            <div class="sub-header-cell sub-header-center">Helper / Driver? ✎</div>
            <div class="sub-header-cell sub-header-center">Dietary</div>
            <div class="sub-header-cell"></div>
          </div>

          <div class="submissions-list">
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
              <!-- Col 1: Country + Dish pills -->
              <div class="submission-bar form-section-top-bar">
                <div class="form-section-top-bar-inner">
                  <div class="form-section-pill">
                    <span class="submission-country-display" :title="sub.country_code || ''">{{ countryLabel(sub.country_code) }}</span>
                  </div>
                  <div class="form-section-pill submission-dish-pill">
                    <span class="form-section-pill-input submission-dish-text">{{ sub.dish_name || 'dish name...' }}</span>
                  </div>
                </div>
              </div>

              <!-- Col 2: Members -->
              <div class="kitchen-cell">
                {{ (sub.members || []).join(', ') || '—' }}
              </div>

              <!-- Col 3: Equipment Requested (read-only) -->
              <div class="kitchen-cell">
                <span v-if="sub.needs_utensils === 'yes' && sub.utensils_notes" class="kitchen-notes-text">{{ sub.utensils_notes }}</span>
                <span v-else-if="sub.needs_utensils === 'yes'" class="kitchen-cell-empty">Needs utensils</span>
                <span v-else-if="sub.needs_utensils === 'no'" class="kitchen-cell-empty">None needed</span>
                <span v-else class="kitchen-cell-empty">—</span>
              </div>

              <!-- Col 4: Equipment Allocated (editable) -->
              <div
                class="kitchen-cell kitchen-cell-editable"
                :class="{ 'kitchen-cell-active': isKitchenEditing(sub.id, 'equipment_allocated') }"
                @dblclick.stop="startKitchenEdit(sub.id, 'equipment_allocated', sub.equipment_allocated)"
              >
                <input
                  v-if="isKitchenEditing(sub.id, 'equipment_allocated')"
                  v-model="kitchenEditing[kitchenKey(sub.id, 'equipment_allocated')]"
                  class="kitchen-cell-input"
                  type="text"
                  autofocus
                  @click.stop
                  @blur="saveKitchenField(sub, 'equipment_allocated')"
                  @keyup.enter="saveKitchenField(sub, 'equipment_allocated')"
                  @keyup.escape="cancelKitchenEdit(sub.id, 'equipment_allocated')"
                />
                <span v-else-if="sub.equipment_allocated" class="kitchen-notes-text">{{ sub.equipment_allocated }}</span>
                <span v-else class="kitchen-cell-hint">double-click</span>
              </div>

              <!-- Col 5: Kitchen / Location (editable) -->
              <div
                class="kitchen-cell kitchen-cell-editable"
                :class="{ 'kitchen-cell-active': isKitchenEditing(sub.id, 'cooking_location') }"
                @dblclick.stop="startKitchenEdit(sub.id, 'cooking_location', sub.cooking_location)"
              >
                <input
                  v-if="isKitchenEditing(sub.id, 'cooking_location')"
                  v-model="kitchenEditing[kitchenKey(sub.id, 'cooking_location')]"
                  class="kitchen-cell-input"
                  type="text"
                  autofocus
                  @click.stop
                  @blur="saveKitchenField(sub, 'cooking_location')"
                  @keyup.enter="saveKitchenField(sub, 'cooking_location')"
                  @keyup.escape="cancelKitchenEdit(sub.id, 'cooking_location')"
                />
                <span v-else-if="sub.cooking_location" class="kitchen-notes-text">{{ sub.cooking_location }}</span>
                <span v-else class="kitchen-cell-hint">double-click</span>
              </div>

              <!-- Col 6: Helper / Driver? (editable) -->
              <div
                class="kitchen-cell kitchen-cell-editable"
                :class="{ 'kitchen-cell-active': isKitchenEditing(sub.id, 'helper_driver_needed') }"
                @dblclick.stop="startKitchenEdit(sub.id, 'helper_driver_needed', sub.helper_driver_needed)"
              >
                <input
                  v-if="isKitchenEditing(sub.id, 'helper_driver_needed')"
                  v-model="kitchenEditing[kitchenKey(sub.id, 'helper_driver_needed')]"
                  class="kitchen-cell-input"
                  type="text"
                  autofocus
                  @click.stop
                  @blur="saveKitchenField(sub, 'helper_driver_needed')"
                  @keyup.enter="saveKitchenField(sub, 'helper_driver_needed')"
                  @keyup.escape="cancelKitchenEdit(sub.id, 'helper_driver_needed')"
                />
                <span v-else-if="sub.helper_driver_needed" class="kitchen-notes-text">{{ sub.helper_driver_needed }}</span>
                <span v-else class="kitchen-cell-hint">double-click</span>
              </div>

              <!-- Col 7: Dietary icons -->
              <div class="sub-col-dietary">
                <DietaryIcons :dietary="aggregateDietary(sub)" :size="14" />
              </div>

              <!-- Col 8: Expand arrow (far right) -->
              <div class="sub-col-arrow">
                {{ expandedSubmissions.has(sub.id) ? '▲' : '▼' }}
              </div>
            </button>

            <div v-if="expandedSubmissions.has(sub.id)" class="submission-detail">
              <div class="submission-detail-meta">
                <div class="submission-detail-meta-grid">
                  <div class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Phone</span>
                    <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': !(sub.phone_number || '').trim() }">{{ (sub.phone_number || '').trim() || '—' }}</span>
                  </div>
                  <div class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Has Own Kitchen</span>
                    <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': !sub.has_cooking_place }">{{ sub.has_cooking_place ? (sub.has_cooking_place === 'yes' ? 'Yes ✅' : 'No ❌') : '—' }}</span>
                  </div>
                  <div v-if="sub.found_all_ingredients" class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Ingredients</span>
                    <span class="submission-detail-meta-value">{{ sub.found_all_ingredients === 'yes' ? 'All Found ✅' : 'Missing Items ⚠️' }}</span>
                  </div>
                  <div v-if="sub.needs_utensils" class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Utensils</span>
                    <span class="submission-detail-meta-value">{{ sub.needs_utensils === 'yes' ? 'Needs Utensils ⚠️' : 'No Utensils ✅' }}</span>
                  </div>
                </div>
              </div>
              <div class="form-section-ingredients submission-detail-ingredients">
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
      </div>

      <!-- Grocery List Tab -->
      <div v-else-if="activeTab === 'grocery' && groceryList">
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

      <!-- Notifications Tab -->
      <div v-else-if="activeTab === 'notifications'">
        <div v-if="!notifStore.notifications.length" class="dashboard-empty">No notifications yet.</div>
        <div v-else>
          <div v-if="notifStore.unreadCount > 0" class="notif-tab-actions">
            <button type="button" class="btn-pill-secondary" @click="notifStore.markAllRead()">Mark all read</button>
          </div>
          <div class="submissions-list">
            <div
              v-for="n in notifStore.notifications"
              :key="n.id"
              class="submission-card notif-card"
              :class="{ 'notif-card-read': n.read }"
              :style="{ borderLeftColor: notifDotColor(n.event_type) }"
            >
              <div class="notif-card-row">
                <div class="notif-card-dot" :style="{ background: notifDotColor(n.event_type) }" />
                <div class="notif-card-body">
                  <div class="notif-card-title">{{ n.title }}</div>
                  <div v-if="n.message" class="notif-card-message">{{ n.message }}</div>
                </div>
                <div class="notif-card-time">{{ notifRelativeTime(n.created_at) }}</div>
              </div>
            </div>
          </div>
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

/* Subtab bar: mini header — maroon pill bar */
.dashboard-subtab-bar {
  flex: none;
  align-self: flex-start;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-lafayette-red, #910029);
  border-radius: 1rem;
  margin: 0.75rem 0 0.75rem 1rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.dashboard-subtab-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dashboard-subtab {
  border-radius: 9999px;
  padding: 0.5rem 1.5rem;
  min-height: 2.75rem;
  font-size: 1.25rem;
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
  border-color: #fff;
}

.dashboard-subtab-active:hover {
  background-color: #fff;
  color: var(--color-lafayette-red, #910029);
}

.dashboard-subtab-inactive {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.88);
}

.dashboard-subtab-inactive:hover {
  background-color: rgba(255, 255, 255, 0.18);
  color: #fff;
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

/* Remove macOS/default focus outlines from all focusable elements on this page */
.dashboard button:focus,
.dashboard button:focus-visible,
.dashboard input:focus,
.dashboard input:focus-visible,
.dashboard label:focus,
.dashboard label:focus-visible {
  outline: none;
  box-shadow: none;
}

/* Submissions: scroll wrapper + card + grid row */
.submissions-scroll-wrap {
  overflow: visible;
}

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

/*
  Shared 8-column grid — IDENTICAL template on header and every data row.
  col 1 : country+dish pills  (min 16rem, 2× fr weight)
  cols 2-6: data columns      (equal 1fr — resolves identically in both
                               containers because they share the same parent width)
  col 7: dietary icons        (fixed 4rem — predictable icon width)
  col 8: expand arrow         (fixed 2rem — always at the far right)
*/
.submission-table-header,
.submission-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(5, 1fr) 4rem 2rem;
  gap: 0.75rem;
  align-items: center;
}

.submission-table-header {
  background: var(--color-lafayette-red, #910029);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  border-radius: 0.75rem;
  padding: 0.5rem 1rem;
  margin-bottom: 0.5rem;
}

.sub-header-cell {
  min-width: 0;
}

.sub-header-center {
  text-align: center;
}

.submission-row {
  width: 100%;
  padding: 0.6rem 1rem;
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

/* Col 1: pill structure styles */
.submission-bar {
  min-width: 0;
  overflow: hidden;
}

.submission-country-display {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.25rem 1rem;
  min-height: 2rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submission-bar .submission-dish-pill {
  flex: none;
  width: fit-content;
  min-width: 0;
}

.submission-dish-pill .form-section-pill-input {
  width: auto;
  min-width: 4ch;
  min-height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.submission-dish-text {
  display: block;
  min-width: 0;
  white-space: nowrap;
}

/* Col 7: dietary icons — centered */
.sub-col-dietary {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Col 8: expand arrow — pushed to the far right of the row */
.sub-col-arrow {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 0.75rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.submission-detail {
  padding: 0 1rem 1rem;
}

.submission-detail-meta {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 1rem;
  font-size: var(--body-font-size, 1.125rem);
}

.submission-detail-meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  gap: 0.75rem 1.5rem;
}

.submission-detail-meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.submission-detail-meta-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
}

.submission-detail-meta-value {
  font-size: inherit;
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
  line-height: 1.5;
}

.submission-detail-meta-value.submission-detail-meta-empty {
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.7;
  font-style: italic;
}

/* Align ingredients block with meta bar: same horizontal extent and content alignment */
.submission-detail-ingredients {
  flex: none;
  min-height: 0;
  padding-left: 0;
  padding-right: 0;
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

.add-product-err {
  margin-top: 0.5rem;
}

/* Notifications tab: badge on tab button */
@keyframes notif-badge-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(253, 211, 77, 0.7); }
  50%       { transform: scale(1.08); box-shadow: 0 0 0 5px rgba(253, 211, 77, 0); }
}

.dashboard-notif-badge {
  margin-left: 0.625rem;
  min-width: 1.75rem;
  height: 1.75rem;
  background: #fcd34d;
  color: #1c1917;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.375rem;
  line-height: 1;
  animation: notif-badge-pulse 2s ease-in-out infinite;
}

.dashboard-subtab-active .dashboard-notif-badge {
  background: #fcd34d;
  color: #1c1917;
  box-shadow: none;
  animation: none;
}


/* Notifications tab: mark-all action row */
.notif-tab-actions {
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: flex-end;
}

/* Notification cards */
.notif-card {
  border-left: 3px solid transparent;
}

.notif-card-read {
  opacity: 0.55;
}

.notif-card-row {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
}

.notif-card-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  flex-shrink: 0;
  margin-top: 0.4rem;
}

.notif-card-body {
  flex: 1;
  min-width: 0;
}

.notif-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-lafayette-gray, #3c373c);
  line-height: 1.3;
}

.notif-card-message {
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.65;
  margin-top: 0.125rem;
  line-height: 1.3;
}

.notif-card-time {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.45;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

/* ─── Kitchen & Utensils Table ────────────────────────────────────────────── */

.kitchen-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.kitchen-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.kitchen-save-error {
  font-size: 0.9375rem;
  color: #b91c1c;
}

.kitchen-addrow-form {
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  box-shadow: var(--shadow-natural, 6px 6px 9px rgba(0, 0, 0, 0.2));
}

.kitchen-addrow-fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.kitchen-addrow-input {
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 9999px;
  padding: 0.4rem 1rem;
  min-height: 2.75rem;
  font-size: 1rem;
  font-family: inherit;
  font-weight: 500;
  outline: none;
  min-width: 10rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.kitchen-addrow-input-grow {
  flex: 1 1 auto;
}

.kitchen-table {
  overflow-x: auto;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/*
  7-column grid:
  country  dish    members  equip-req  equip-alloc  location  helper
  10rem    12rem   12rem    14rem      14rem         12rem     9rem
*/
.kitchen-header-row,
.kitchen-data-row {
  display: grid;
  grid-template-columns: 10rem 12rem 12rem 14rem 14rem 12rem 9rem;
  gap: 0.75rem;
  align-items: start;
  min-width: 0;
}

.kitchen-header-row {
  background: var(--color-lafayette-red, #910029);
  border-radius: 0.75rem;
  padding: 0.5rem 1rem;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.kitchen-data-row {
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 0.75rem;
  padding: 0.6rem 1rem;
  font-size: 0.9375rem;
  transition: background-color 0.1s;
}

.kitchen-data-row:hover {
  background: #d8d5d1;
}

.kitchen-cell {
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--color-lafayette-gray, #3c373c);
}

.kitchen-cell-editable {
  cursor: default;
  border-radius: 0.375rem;
  padding: 0.1rem 0.3rem;
  margin: -0.1rem -0.3rem;
  transition: background-color 0.1s;
}

.kitchen-cell-editable:hover {
  background: rgba(0, 0, 0, 0.06);
  cursor: text;
}

.kitchen-cell-active {
  background: #fff !important;
  box-shadow: 0 0 0 2px var(--color-lafayette-dark-blue, #006690);
  border-radius: 0.375rem;
}

.kitchen-cell-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: inherit;
  font-family: inherit;
  font-weight: 500;
  padding: 0;
  line-height: 1.4;
  color: var(--color-lafayette-gray, #3c373c);
}

.kitchen-cell-hint {
  font-size: 0.8125rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.35;
  font-style: italic;
}

.kitchen-cell-empty {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.55;
}

.kitchen-notes-text {
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
}
</style>
