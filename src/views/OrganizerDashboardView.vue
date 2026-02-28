<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useRouter } from 'vue-router'
import { createConsumer } from '@rails/actioncable'
import IngredientThumb from '@/components/IngredientThumb.vue'
import IngredientRow from '@/components/IngredientRow.vue'
import DietaryIcons from '@/components/DietaryIcons.vue'
import KitchenResourceSelect from '@/components/KitchenResourceSelect.vue'
import KitchenResourceMultiSelect from '@/components/KitchenResourceMultiSelect.vue'
import { getAllSubmissions, type SubmissionResponse } from '@/api/submissions'
import { getGroceryList, checkGroceryItem, updateGroceryQuantity, updateSubmissionIngredientQuantity, deleteSubmission, updateKitchenAllocation, getKitchenResources, createKitchenResource, updateKitchenResource, deleteKitchenResource, type GroceryListResponse, type GroceryItem, type KitchenAllocationPayload, type KitchenResourceItem } from '@/api/organizer'
import LockOverlay from '@/components/LockOverlay.vue'
import { useLockOverlay } from '@/composables/useLockOverlay'
import { COUNTRIES, flagEmoji } from '@/data/countries'
import { useSubmissionStore } from '@/stores/submission'
import { useNotificationStore } from '@/stores/notifications'
import type { NotificationItem } from '@/api/notifications'
import type { Ingredient, IngredientDietary } from '@/types/ingredient'

const router = useRouter()
const submissionStore = useSubmissionStore()
const notifStore = useNotificationStore()
const { isLocked } = useLockOverlay()

// Re-load kitchen resources after the organizer unlocks, since onMounted runs
// before auth and the first attempt silently fails (401, no token yet).
watch(isLocked, (locked) => {
  if (!locked) loadKitchenResources()
})

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


const activeTab = ref<'submissions' | 'grocery' | 'kitchens' | 'notifications'>('submissions')
const groceryStore = ref<'giant' | 'other-stores'>('giant') // tab bar above aisles: Giant | Other Stores
const kuSubTab = ref<'fridges' | 'kitchens' | 'utensils' | 'helpers'>('fridges') // Kitchens & Utensils sub-tabs
const addingKuType = ref<'fridge' | 'kitchen' | 'utensil' | 'helper_driver' | null>(null) // show add-card with input
const kuAddInputRef = ref<HTMLInputElement | null>(null)
const kuEditInputRef = ref<HTMLInputElement | null>(null)
const submissions = ref<SubmissionResponse[]>([])
const groceryList = ref<GroceryListResponse | null>(null)
const expandedSubmissions = ref<Set<number>>(new Set())

function toggleSubmissionExpanded(id: number) {
  const next = new Set(expandedSubmissions.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedSubmissions.value = next
}

// ─── Grocery aisle expand/collapse ────────────────────────────
const expandedAisles = ref<Set<string>>(new Set())

function toggleAisleExpanded(aisle: string) {
  const next = new Set(expandedAisles.value)
  if (next.has(aisle)) next.delete(aisle)
  else next.add(aisle)
  expandedAisles.value = next
}

function aisleTotal(items: GroceryItem[]): number {
  return items.reduce((sum, i) => sum + i.ingredient.price_cents * i.total_quantity, 0)
}

function aisleQtySum(items: GroceryItem[]): number {
  return items.reduce((sum, i) => sum + i.total_quantity, 0)
}

// ─── Grocery lightbox ─────────────────────────────────────────
const groceryLightboxOpen = ref(false)
const groceryLightboxSrc = ref<string | null>(null)
const groceryLightboxAlt = ref('')
const GROCERY_API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:1826'

function openGroceryLightbox(item: GroceryItem) {
  const url = item.ingredient.image_url
  if (!url || typeof url !== 'string' || !url.trim()) return
  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    groceryLightboxSrc.value = trimmed
  } else {
    const base = (GROCERY_API_BASE as string).replace(/\/$/, '')
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
    groceryLightboxSrc.value = `${base}${path}`
  }
  groceryLightboxAlt.value = item.ingredient.name
  groceryLightboxOpen.value = true
}

function closeGroceryLightbox() {
  groceryLightboxOpen.value = false
}

function handleGroceryLightboxEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') closeGroceryLightbox()
}

watch(groceryLightboxOpen, (open) => {
  if (open) document.addEventListener('keydown', handleGroceryLightboxEsc)
  else document.removeEventListener('keydown', handleGroceryLightboxEsc)
})

onUnmounted(() => document.removeEventListener('keydown', handleGroceryLightboxEsc))

const isLoading = ref(false)
const error = ref<string | null>(null)
const addProductError = ref<string | null>(null)

// Action Cable consumer
const cable = createConsumer(`${import.meta.env.VITE_API_BASE_URL.replace(/^http/, 'ws')}/cable`)
onMounted(async () => {
  await Promise.all([loadSubmissions(), loadKitchenResources()])
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
    // Default all aisles to collapsed
    expandedAisles.value = new Set()
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

async function switchToSubmissions() {
  activeTab.value = 'submissions'
  addProductError.value = null
  if (!kitchensAvailable.value.length && !utensilsAvailable.value.length) {
    await loadKitchenResources()
  }
}

async function switchToKitchens() {
  activeTab.value = 'kitchens'
  addProductError.value = null
  if (!kitchensAvailable.value.length && !utensilsAvailable.value.length) {
    await loadKitchenResources()
  }
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
  if (!aisle || aisle === 'Other' || aisle === 'Unknown') return 'Aisle Other'
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

const grandTotalQty = computed(() => {
  if (!groceryList.value) return 0
  return Object.values(groceryList.value.aisles).reduce(
    (sum, items) => sum + items.reduce((s, i) => s + i.total_quantity, 0),
    0,
  )
})

function parseEquipmentAllocated(val: string | null | undefined): string[] {
  if (!val) return []
  return val.split(',').map((s) => s.trim()).filter(Boolean)
}

const assignedEquipmentNames = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const sub of submissions.value) {
    for (const name of parseEquipmentAllocated(sub.equipment_allocated)) {
      set.add(name)
    }
  }
  return set
})

const assignedKitchenNames = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const sub of submissions.value) {
    if (sub.cooking_location && sub.cooking_location.trim()) {
      set.add(sub.cooking_location.trim())
    }
  }
  return set
})

const assignedFridgeNames = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const sub of submissions.value) {
    if (sub.fridge_location && sub.fridge_location.trim()) {
      set.add(sub.fridge_location.trim())
    }
  }
  return set
})

const assignedHelperNames = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const sub of submissions.value) {
    if (sub.helper_driver_needed && sub.helper_driver_needed.trim()) {
      set.add(sub.helper_driver_needed.trim())
    }
  }
  return set
})

// ─── Kitchen table (per-submission fields) ────────────────────────────────


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

// ─── Kitchens & Utensils tab (standalone lists) ───────────────────────────

type KuListKind = 'kitchen' | 'utensil' | 'helper_driver' | 'fridge'

const fridgesAvailable = ref<KitchenResourceItem[]>([])
const kitchensAvailable = ref<KitchenResourceItem[]>([])
const utensilsAvailable = ref<KitchenResourceItem[]>([])
const helpersDriversAvailable = ref<KitchenResourceItem[]>([])
const newFridgeName = ref('')
const newKitchenName = ref('')
const newUtensilName = ref('')
const newHelperDriverName = ref('')
const kuEditing = ref<Record<string, string>>({})

function kuKey(kind: KuListKind, id: number) {
  return `${kind}:${id}`
}

function isKuEditing(kind: KuListKind, id: number) {
  return kuKey(kind, id) in kuEditing.value
}

async function startKuEdit(kind: KuListKind, id: number, current: string) {
  kuEditing.value[kuKey(kind, id)] = current
  await nextTick()
  // Ref inside v-for is an array; focus the (only) visible edit input, same timing as add
  const el = kuEditInputRef.value
  const input = Array.isArray(el) ? el[0] : el
  setTimeout(() => (input as HTMLInputElement | undefined)?.focus(), 0)
}

function cancelKuEdit(kind: KuListKind, id: number) {
  const next = { ...kuEditing.value }
  delete next[kuKey(kind, id)]
  kuEditing.value = next
}

function kuListRef(kind: KuListKind): Ref<KitchenResourceItem[]> {
  if (kind === 'kitchen') return kitchensAvailable
  if (kind === 'utensil') return utensilsAvailable
  if (kind === 'helper_driver') return helpersDriversAvailable
  return fridgesAvailable
}

function saveKuName(kind: KuListKind, id: number) {
  const key = kuKey(kind, id)
  const value = kuEditing.value[key]
  if (value === undefined) return
  const listRef = kuListRef(kind)
  const trimmed = value.trim()
  if (!trimmed) {
    cancelKuEdit(kind, id)
    return
  }
  const idx = listRef.value.findIndex((row) => row.id === id)
  if (idx === -1) {
    cancelKuEdit(kind, id)
    return
  }
  const original: KitchenResourceItem = listRef.value[idx]!
  listRef.value[idx] = { ...original, name: trimmed } as KitchenResourceItem
  cancelKuEdit(kind, id)
  updateKitchenResource(id, { name: trimmed }).catch((err) => {
    // revert local change on error
    listRef.value[idx] = original
    console.error(err)
  })
}

function addKitchenRow() {
  const name = newKitchenName.value.trim()
  if (!name) return
  createKitchenResource('kitchen', name)
    .then((created) => {
      kitchensAvailable.value = [created, ...kitchensAvailable.value]
      newKitchenName.value = ''
      addingKuType.value = null
    })
    .catch((err) => {
      console.error(err)
    })
}

function addFridgeRow() {
  const name = newFridgeName.value.trim()
  if (!name) return
  createKitchenResource('fridge', name)
    .then((created) => {
      fridgesAvailable.value = [created, ...fridgesAvailable.value]
      newFridgeName.value = ''
      addingKuType.value = null
    })
    .catch((err) => {
      console.error(err)
    })
}

function addUtensilRow() {
  const name = newUtensilName.value.trim()
  if (!name) return
  createKitchenResource('utensil', name)
    .then((created) => {
      utensilsAvailable.value = [created, ...utensilsAvailable.value]
      newUtensilName.value = ''
      addingKuType.value = null
    })
    .catch((err) => {
      console.error(err)
    })
}

function addHelperDriverRow() {
  const name = newHelperDriverName.value.trim()
  if (!name) return
  createKitchenResource('helper_driver', name)
    .then((created) => {
      helpersDriversAvailable.value = [created, ...helpersDriversAvailable.value]
      newHelperDriverName.value = ''
      addingKuType.value = null
    })
    .catch((err) => {
      console.error(err)
    })
}

const kuSubTabToType = { fridges: 'fridge', kitchens: 'kitchen', utensils: 'utensil', helpers: 'helper_driver' } as const
async function startAddingKu() {
  const t = kuSubTabToType[kuSubTab.value]
  addingKuType.value = t
  if (t === 'fridge') newFridgeName.value = ''
  else if (t === 'kitchen') newKitchenName.value = ''
  else if (t === 'utensil') newUtensilName.value = ''
  else newHelperDriverName.value = ''
  await nextTick()
  kuAddInputRef.value?.focus()
}
function cancelAddingKu() {
  addingKuType.value = null
}
function commitAddFridge() {
  if (addingKuType.value !== 'fridge') return
  addFridgeRow()
}
function commitAddKitchen() {
  if (addingKuType.value !== 'kitchen') return
  addKitchenRow()
}
function commitAddUtensil() {
  if (addingKuType.value !== 'utensil') return
  addUtensilRow()
}
function commitAddHelperDriver() {
  if (addingKuType.value !== 'helper_driver') return
  addHelperDriverRow()
}
function onAddFridgeBlur() {
  if (newFridgeName.value.trim()) commitAddFridge()
  else cancelAddingKu()
}
function onAddKitchenBlur() {
  if (newKitchenName.value.trim()) commitAddKitchen()
  else cancelAddingKu()
}
function onAddUtensilBlur() {
  if (newUtensilName.value.trim()) commitAddUtensil()
  else cancelAddingKu()
}
function onAddHelperBlur() {
  if (newHelperDriverName.value.trim()) commitAddHelperDriver()
  else cancelAddingKu()
}

/** When a resource is deleted from the list, clear that assignment from all submissions so re-adding the same name does not auto-reassign. */
async function clearSubmissionsAssignmentsForDeletedResource(kind: KuListKind, resourceName: string) {
  const name = resourceName.trim()
  if (!name) return
  const toUpdate: Array<{ sub: SubmissionResponse; payload: KitchenAllocationPayload }> = []
  if (kind === 'fridge') {
    for (const sub of submissions.value) {
      if ((sub.fridge_location || '').trim() === name) toUpdate.push({ sub, payload: { fridge_location: null } })
    }
  } else if (kind === 'kitchen') {
    for (const sub of submissions.value) {
      if ((sub.cooking_location || '').trim() === name) toUpdate.push({ sub, payload: { cooking_location: null } })
    }
  } else if (kind === 'helper_driver') {
    for (const sub of submissions.value) {
      if ((sub.helper_driver_needed || '').trim() === name) toUpdate.push({ sub, payload: { helper_driver_needed: null } })
    }
  } else if (kind === 'utensil') {
    for (const sub of submissions.value) {
      const current = parseEquipmentAllocated(sub.equipment_allocated)
      if (!current.includes(name)) continue
      const newList = current.filter((n) => n !== name)
      toUpdate.push({ sub, payload: { equipment_allocated: newList.length ? newList.join(', ') : null } })
    }
  }
  for (const { sub, payload } of toUpdate) {
    try {
      const updated = await updateKitchenAllocation(sub.id, payload)
      const idx = submissions.value.findIndex((s) => s.id === updated.id)
      if (idx !== -1) submissions.value[idx] = updated
    } catch (err) {
      console.error('[clearSubmissionsAssignmentsForDeletedResource]', err)
    }
  }
}

function deleteKuRow(kind: KuListKind, id: number) {
  const listRef = kuListRef(kind)
  const row = listRef.value.find((r) => r.id === id)
  if (!row) return
  const deletedName = row.name.trim()
  const previous = listRef.value
  listRef.value = listRef.value.filter((r) => r.id !== id)
  cancelKuEdit(kind, id)
  deleteKitchenResource(id)
    .then(() => clearSubmissionsAssignmentsForDeletedResource(kind, deletedName))
    .catch((err) => {
      console.error(err)
      listRef.value = previous
    })
}

async function loadKitchenResources() {
  try {
    const all = await getKitchenResources()
    fridgesAvailable.value = all.filter((r) => r.kind === 'fridge')
    kitchensAvailable.value = all.filter((r) => r.kind === 'kitchen')
    utensilsAvailable.value = all.filter((r) => r.kind === 'utensil')
    helpersDriversAvailable.value = all.filter((r) => r.kind === 'helper_driver')
  } catch (err) {
    console.error('[KitchenResources] load FAILED:', err)
  }
}

async function assignKitchenField(
  sub: SubmissionResponse,
  field: 'equipment_allocated' | 'cooking_location' | 'fridge_location' | 'helper_driver_needed',
  value: string,
) {
  const saveValue = value || null  // empty string → null to clear on backend
  const subInList = submissions.value.find((s) => s.id === sub.id)
  if (!subInList) return
  const prev = (subInList as Record<string, unknown>)[field]
  ;(subInList as Record<string, unknown>)[field] = saveValue
  kitchenSaveError.value = null
  try {
    const updated = await updateKitchenAllocation(sub.id, { [field]: saveValue } as KitchenAllocationPayload)
    const idx = submissions.value.findIndex((s) => s.id === updated.id)
    if (idx !== -1) submissions.value[idx] = updated
  } catch (err) {
    ;(subInList as Record<string, unknown>)[field] = prev
    kitchenSaveError.value = err instanceof Error ? err.message : 'Save failed'
  }
}

function equipmentOptionsFor(sub: SubmissionResponse): string[] {
  const used = assignedEquipmentNames.value
  const currentSet = new Set(parseEquipmentAllocated(sub.equipment_allocated))
  const allNames = utensilsAvailable.value.map((r) => r.name.trim()).filter(Boolean)
  return allNames.filter((name, index) => {
    if (allNames.indexOf(name) !== index) return false
    if (!used.has(name)) return true
    return currentSet.has(name)
  })
}

function equipmentAllocatedValues(sub: SubmissionResponse): string[] {
  const options = equipmentOptionsFor(sub)
  return parseEquipmentAllocated(sub.equipment_allocated).filter((v) => options.includes(v))
}

async function assignEquipmentMulti(sub: SubmissionResponse, names: string[]) {
  await assignKitchenField(sub, 'equipment_allocated', names.join(', '))
}

function kitchenOptionsFor(sub: SubmissionResponse): string[] {
  const used = assignedKitchenNames.value
  const current = (sub.cooking_location || '').trim()
  const allNames = kitchensAvailable.value.map((r) => r.name.trim()).filter(Boolean)
  return allNames.filter((name, index) => {
    if (allNames.indexOf(name) !== index) return false
    if (!used.has(name)) return true
    return current === name
  })
}

function fridgeOptionsFor(sub: SubmissionResponse): string[] {
  const used = assignedFridgeNames.value
  const current = (sub.fridge_location || '').trim()
  const allNames = fridgesAvailable.value.map((r) => r.name.trim()).filter(Boolean)
  return allNames.filter((name, index) => {
    if (allNames.indexOf(name) !== index) return false
    if (!used.has(name)) return true
    return current === name
  })
}

/** Display value for fridge select: only show submission's fridge if it's still in the current fridge list. */
function effectiveFridgeValue(sub: SubmissionResponse): string | null {
  const val = (sub.fridge_location || '').trim()
  if (!val) return null
  return fridgeOptionsFor(sub).includes(val) ? sub.fridge_location : null
}

/** Display value for kitchen select: only show submission's kitchen if it's still in the current kitchen list. */
function effectiveKitchenValue(sub: SubmissionResponse): string | null {
  const val = (sub.cooking_location || '').trim()
  if (!val) return null
  return kitchenOptionsFor(sub).includes(val) ? sub.cooking_location : null
}

function helperOptions(sub: SubmissionResponse): string[] {
  const used = assignedHelperNames.value
  const current = (sub.helper_driver_needed || '').trim()
  const allNames = helpersDriversAvailable.value.map((r) => r.name.trim()).filter(Boolean)
  return allNames.filter((name, index) => {
    if (allNames.indexOf(name) !== index) return false
    if (!used.has(name)) return true
    return current === name
  })
}

/** Display value for helper select: only show submission's helper if it's still in the current helper list. */
function effectiveHelperValue(sub: SubmissionResponse): string | null {
  const val = (sub.helper_driver_needed || '').trim()
  if (!val) return null
  return helperOptions(sub).includes(val) ? sub.helper_driver_needed : null
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
          @click="switchToSubmissions"
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
          :class="activeTab === 'kitchens' ? 'dashboard-subtab-active' : 'dashboard-subtab-inactive'"
          @click="switchToKitchens"
        >
          Assignments
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
            <div class="sub-header-cell sub-header-center">Fridge Needed</div>
            <div class="sub-header-cell sub-header-center">Requested</div>
            <div class="sub-header-cell sub-header-center">Allocated</div>
            <div class="sub-header-cell sub-header-center">Kitchen</div>
            <div class="sub-header-cell sub-header-center">Helper/Driver</div>
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
              <div class="submission-bar">
                <div class="form-section-pill">
                  <span class="submission-country-display" :title="countryLabel(sub.country_code)">{{ sub.country_code ? flagEmoji(sub.country_code) : '🏳️' }}</span>
                </div>
                <div class="form-section-pill submission-dish-pill">
                  <span class="form-section-pill-input submission-dish-text" :class="{ 'submission-dish-placeholder': !sub.dish_name }">{{ sub.dish_name || 'dish name...' }}</span>
                </div>
              </div>

              <!-- Col 2: Members -->
              <div class="kitchen-cell">
                {{ (sub.members || []).join(', ') || '—' }}
              </div>

              <!-- Col 3: Fridge Needed -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <template v-if="sub.needs_fridge_space === 'yes'">
                  <div class="form-section-pill kitchen-resource-pill">
                    <KitchenResourceSelect
                      :model-value="effectiveFridgeValue(sub)"
                      :options="fridgeOptionsFor(sub)"
                      placeholder="Assign fridge"
                      clearable
                      @update:model-value="(val) => assignKitchenField(sub, 'fridge_location', val)"
                    />
                  </div>
                </template>
                <template v-else>
                  <span v-if="sub.needs_fridge_space === 'no'">No</span>
                  <span v-else>—</span>
                </template>
              </div>

              <!-- Col 4: Equipment Requested (read-only) -->
              <div class="kitchen-cell">
                <span v-if="sub.needs_utensils === 'yes' && sub.utensils_notes">{{ sub.utensils_notes }}</span>
                <span v-else-if="sub.needs_utensils === 'yes'">Needs utensils</span>
                <span v-else-if="sub.needs_utensils === 'no'">—</span>
                <span v-else>—</span>
              </div>

              <!-- Col 5: Equipment Allocated (editable) -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <template v-if="sub.needs_utensils === 'yes'">
                  <div class="form-section-pill kitchen-resource-pill">
                    <KitchenResourceMultiSelect
                      :model-value="equipmentAllocatedValues(sub)"
                      :options="equipmentOptionsFor(sub)"
                      placeholder="Assign equipment"
                      @update:model-value="(vals) => assignEquipmentMulti(sub, vals)"
                    />
                  </div>
                </template>
                <span v-else>—</span>
              </div>

              <!-- Col 6: Kitchen / Location (editable) -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <template v-if="sub.has_cooking_place === 'no'">
                  <div class="form-section-pill kitchen-resource-pill">
                    <KitchenResourceSelect
                      :model-value="effectiveKitchenValue(sub)"
                      :options="kitchenOptionsFor(sub)"
                      placeholder="Assign kitchen"
                      clearable
                      @update:model-value="(val) => assignKitchenField(sub, 'cooking_location', val)"
                    />
                  </div>
                </template>
                <template v-else>
                  <div
                    class="kitchen-cell-inner-editable"
                    :class="{ 'kitchen-cell-active': isKitchenEditing(sub.id, 'cooking_location') }"
                    @dblclick.stop="startKitchenEdit(sub.id, 'cooking_location', sub.cooking_location)"
                  >
                    <input
                      v-if="isKitchenEditing(sub.id, 'cooking_location')"
                      v-model="kitchenEditing[kitchenKey(sub.id, 'cooking_location')]"
                      class="kitchen-cell-input"
                      type="text"
                      autofocus
                      @blur="saveKitchenField(sub, 'cooking_location')"
                      @keyup.enter="saveKitchenField(sub, 'cooking_location')"
                      @keyup.escape="cancelKitchenEdit(sub.id, 'cooking_location')"
                    />
                    <span v-else>{{ effectiveKitchenValue(sub) || '—' }}</span>
                  </div>
                </template>
              </div>

              <!-- Col 7: Helper / Driver? (Assign helper dropdown) -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <div class="form-section-pill kitchen-resource-pill">
                  <KitchenResourceSelect
                    :model-value="effectiveHelperValue(sub)"
                    :options="helperOptions(sub)"
                    placeholder="Assign helper"
                    clearable
                    @update:model-value="(val) => assignKitchenField(sub, 'helper_driver_needed', val)"
                  />
                </div>
              </div>

              <!-- Col 8: Expand arrow (far right) -->
              <div class="sub-col-arrow" :class="{ 'sub-col-arrow-open': expandedSubmissions.has(sub.id) }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
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
                    <span class="submission-detail-meta-label">Kitchen</span>
                    <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': !sub.has_cooking_place }">{{ sub.has_cooking_place ? (sub.has_cooking_place === 'yes' ? 'Has Kitchen ✅' : 'Needs Kitchen ⚠️') : '—' }}</span>
                  </div>
                  <div v-if="sub.needs_fridge_space" class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Fridge</span>
                    <span class="submission-detail-meta-value">{{ sub.needs_fridge_space === 'yes' ? 'Needs Fridge ⚠️' : 'Has Fridge ✅' }}</span>
                  </div>
                  <div v-if="sub.found_all_ingredients" class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Ingredients</span>
                    <span class="submission-detail-meta-value">{{ sub.found_all_ingredients === 'yes' ? 'Has Ingredients ✅' : 'Missing Ingredients ⚠️' }}</span>
                  </div>
                  <div v-if="sub.needs_utensils" class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Utensils</span>
                    <span class="submission-detail-meta-value">{{ sub.needs_utensils === 'yes' ? 'Needs Utensils ⚠️' : 'Has Utensils ✅' }}</span>
                  </div>
                  <div class="submission-detail-meta-item">
                    <span class="submission-detail-meta-label">Dietary Flags</span>
                    <DietaryIcons :dietary="aggregateDietary(sub)" :size="18" />
                  </div>
                  <div class="submission-detail-meta-actions">
                    <button
                      type="button"
                      class="btn-pill-primary"
                      @click.stop="handleEditSubmission(sub)"
                    >
                      Edit Form
                    </button>
                    <button
                      type="button"
                      class="btn-pill-primary"
                      @click.stop="handleDeleteSubmission(sub)"
                    >
                      Delete
                    </button>
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
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- Grocery List Tab -->
      <div v-else-if="activeTab === 'grocery' && groceryList">
        <!-- Store tab bar above Aisles (spacing matches submission-table-header) -->
        <div class="grocery-store-bar">
          <button
            type="button"
            class="grocery-store-tab"
            :class="groceryStore === 'giant' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
            @click="groceryStore = 'giant'"
          >
            Giant
          </button>
          <button
            type="button"
            class="grocery-store-tab"
            :class="groceryStore === 'other-stores' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
            @click="groceryStore = 'other-stores'"
          >
            Other Stores
          </button>
        </div>
        <div v-if="groceryStore === 'giant'" class="grocery-sections">
          <div v-for="(items, aisle) in groceryList.aisles" :key="aisle" class="grocery-aisle-card">
            <!-- Aisle header (collapsible) -->
            <button
              type="button"
              class="grocery-aisle-header"
              @click="toggleAisleExpanded(aisle as string)"
            >
              <div class="grocery-aisle-name-col">
                <div class="form-section-pill grocery-aisle-dish-pill">
                  <span class="form-section-pill-input grocery-aisle-dish-text">{{ formatAisleTitle(aisle as string) }}</span>
                </div>
              </div>
              <span class="grocery-aisle-header-spacer"></span>
              <div class="grocery-product-price grocery-aisle-header-val tabular-nums">${{ (aisleTotal(items) / 100).toFixed(2) }}</div>
              <div class="grocery-product-actions grocery-aisle-header-actions">
                <span class="qty-controls">
                  <span class="tabular-nums qty-num grocery-aisle-header-val">{{ aisleQtySum(items) }}</span>
                  <span class="qty-btn-stack" style="visibility: hidden;">
                    <button type="button" class="qty-btn" tabindex="-1" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                    </button>
                    <button type="button" class="qty-btn" tabindex="-1" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                  </span>
                </span>
              </div>
              <span class="grocery-aisle-arrow" :class="{ 'grocery-aisle-arrow-open': expandedAisles.has(aisle as string) }">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            <!-- Aisle body (expanded) -->
            <div v-if="expandedAisles.has(aisle as string)" class="grocery-aisle-body">
              <div
                v-for="item in items"
                :key="item.ingredient.id"
                class="grocery-product-row"
                :class="{ 'grocery-product-row-checked': item.checked }"
              >
                <label class="grocery-product-checkbox-wrap">
                  <input
                    type="checkbox"
                    :checked="item.checked"
                    class="grocery-checkbox"
                    @change="toggleCheck(item)"
                  />
                </label>
                <IngredientThumb
                  :ingredient="item.ingredient"
                  :class="item.ingredient.image_url ? 'grocery-thumb-clickable' : ''"
                  @click="openGroceryLightbox(item)"
                />
                <div class="grocery-product-info">
                  <span class="grocery-product-name truncate" :class="{ 'line-through': item.checked }">{{ item.ingredient.name }}</span>
                  <span class="grocery-product-size" :class="{ 'line-through': item.checked }">{{ item.ingredient.size }}</span>
                </div>
                <div class="grocery-product-dietary">
                  <DietaryIcons v-if="item.ingredient.dietary" :dietary="item.ingredient.dietary" :size="16" />
                </div>
                <div class="grocery-product-teams truncate" :title="item.teams.join(', ')">
                  {{ item.teams.join(', ') }}
                </div>
                <div class="grocery-product-price tabular-nums">
                  ${{ ((item.ingredient.price_cents * item.total_quantity) / 100).toFixed(2) }}
                </div>
                <div class="grocery-product-actions">
                  <span class="qty-controls">
                    <span class="tabular-nums qty-num">{{ item.total_quantity }}</span>
                    <span class="qty-btn-stack">
                      <button
                        type="button"
                        class="qty-btn"
                        aria-label="Increase quantity"
                        @click.prevent.stop="changeQuantity(item, 1)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                      </button>
                      <button
                        type="button"
                        class="qty-btn"
                        aria-label="Decrease quantity"
                        @click.prevent.stop="changeQuantity(item, -1)"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                      </button>
                    </span>
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>

        <div v-if="groceryStore === 'giant'" class="grocery-aisle-card grocery-grand-total">
          <div class="grocery-aisle-header grocery-grand-total-header">
            <div class="grocery-aisle-name-col">
              <div class="form-section-pill grocery-aisle-dish-pill">
                <span class="form-section-pill-input grocery-aisle-dish-text">Grand Total</span>
              </div>
            </div>
            <span class="grocery-aisle-header-spacer"></span>
            <div class="grocery-product-price grocery-aisle-header-val tabular-nums">${{ (totalCents / 100).toFixed(2) }}</div>
            <div class="grocery-product-actions grocery-aisle-header-actions">
              <span class="qty-controls">
                <span class="tabular-nums qty-num grocery-aisle-header-val">{{ grandTotalQty }}</span>
                <span class="qty-btn-stack" style="visibility: hidden;">
                  <button type="button" class="qty-btn" tabindex="-1" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                  </button>
                  <button type="button" class="qty-btn" tabindex="-1" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Kitchens & Utensils Tab -->
      <div v-else-if="activeTab === 'kitchens'" class="ku-tab">
        <!-- Tab bar row: tabs (in bar) + add button outside bar, all the way right -->
        <div class="ku-tab-bar-row">
          <div class="grocery-store-bar">
            <button
              type="button"
              class="grocery-store-tab"
              :class="kuSubTab === 'fridges' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="kuSubTab = 'fridges'"
            >
              Fridges
            </button>
            <button
              type="button"
              class="grocery-store-tab"
              :class="kuSubTab === 'kitchens' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="kuSubTab = 'kitchens'"
            >
              Kitchens
            </button>
            <button
              type="button"
              class="grocery-store-tab"
              :class="kuSubTab === 'utensils' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="kuSubTab = 'utensils'"
            >
              Utensils/Equipment
            </button>
            <button
              type="button"
              class="grocery-store-tab"
              :class="kuSubTab === 'helpers' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="kuSubTab = 'helpers'"
            >
              Helpers/Drivers
            </button>
          </div>
          <button type="button" class="btn-pill-primary ku-add-btn" aria-label="Add" @click="startAddingKu">{{ kuSubTab === 'fridges' ? 'Add Fridge' : kuSubTab === 'kitchens' ? 'Add Kitchen' : kuSubTab === 'utensils' ? 'Add Utensil/Equipment' : 'Add Helper/Driver' }}</button>
        </div>

        <!-- Fridges -->
        <div v-if="kuSubTab === 'fridges'" class="ku-section">
          <div v-if="addingKuType === 'fridge'" class="grocery-aisle-card ku-item-card ku-add-card">
            <div class="ku-item-row">
              <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                <input
                  ref="kuAddInputRef"
                  v-model="newFridgeName"
                  class="form-section-pill-input ku-cell-input"
                  type="text"
                  placeholder="Fridge location..."
                  @keyup.enter="commitAddFridge"
                  @blur="onAddFridgeBlur"
                  @keyup.escape="cancelAddingKu"
                />
              </div>
            </div>
          </div>
          <div v-if="fridgesAvailable.length" class="ku-card-list">
            <div v-for="row in fridgesAvailable" :key="row.id" class="grocery-aisle-card ku-item-card">
              <div class="ku-item-row">
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <input
                    ref="kuEditInputRef"
                    v-if="isKuEditing('fridge', row.id)"
                    v-model="kuEditing[kuKey('fridge', row.id)]"
                    class="form-section-pill-input ku-cell-input"
                    type="text"
                    @blur="saveKuName('fridge', row.id)"
                    @keyup.enter="saveKuName('fridge', row.id)"
                    @keyup.escape="cancelKuEdit('fridge', row.id)"
                  />
                  <span v-else class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <div class="ku-item-actions">
                  <button type="button" class="btn-pill-primary" @click="startKuEdit('fridge', row.id, row.name)">Edit</button>
                  <button type="button" class="btn-pill-primary" @click="deleteKuRow('fridge', row.id)">Delete</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="ku-empty">No fridges added yet.</div>
        </div>

        <!-- Kitchens -->
        <div v-if="kuSubTab === 'kitchens'" class="ku-section">
          <div v-if="addingKuType === 'kitchen'" class="grocery-aisle-card ku-item-card ku-add-card">
            <div class="ku-item-row">
              <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                <input
                  ref="kuAddInputRef"
                  v-model="newKitchenName"
                  class="form-section-pill-input ku-cell-input"
                  type="text"
                  placeholder="Kitchen location..."
                  @keyup.enter="commitAddKitchen"
                  @blur="onAddKitchenBlur"
                  @keyup.escape="cancelAddingKu"
                />
              </div>
            </div>
          </div>
          <div v-if="kitchensAvailable.length" class="ku-card-list">
            <div v-for="row in kitchensAvailable" :key="row.id" class="grocery-aisle-card ku-item-card">
              <div class="ku-item-row">
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <input
                    ref="kuEditInputRef"
                    v-if="isKuEditing('kitchen', row.id)"
                    v-model="kuEditing[kuKey('kitchen', row.id)]"
                    class="form-section-pill-input ku-cell-input"
                    type="text"
                    @blur="saveKuName('kitchen', row.id)"
                    @keyup.enter="saveKuName('kitchen', row.id)"
                    @keyup.escape="cancelKuEdit('kitchen', row.id)"
                  />
                  <span v-else class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <div class="ku-item-actions">
                  <button type="button" class="btn-pill-primary" @click="startKuEdit('kitchen', row.id, row.name)">Edit</button>
                  <button type="button" class="btn-pill-primary" @click="deleteKuRow('kitchen', row.id)">Delete</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="ku-empty">No kitchens added yet.</div>
        </div>

        <!-- Utensils/Equipment -->
        <div v-if="kuSubTab === 'utensils'" class="ku-section">
          <div v-if="addingKuType === 'utensil'" class="grocery-aisle-card ku-item-card ku-add-card">
            <div class="ku-item-row">
              <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                <input
                  ref="kuAddInputRef"
                  v-model="newUtensilName"
                  class="form-section-pill-input ku-cell-input"
                  type="text"
                  placeholder="Utensil or equipment..."
                  @keyup.enter="commitAddUtensil"
                  @blur="onAddUtensilBlur"
                  @keyup.escape="cancelAddingKu"
                />
              </div>
            </div>
          </div>
          <div v-if="utensilsAvailable.length" class="ku-card-list">
            <div v-for="row in utensilsAvailable" :key="row.id" class="grocery-aisle-card ku-item-card">
              <div class="ku-item-row">
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <input
                    ref="kuEditInputRef"
                    v-if="isKuEditing('utensil', row.id)"
                    v-model="kuEditing[kuKey('utensil', row.id)]"
                    class="form-section-pill-input ku-cell-input"
                    type="text"
                    @blur="saveKuName('utensil', row.id)"
                    @keyup.enter="saveKuName('utensil', row.id)"
                    @keyup.escape="cancelKuEdit('utensil', row.id)"
                  />
                  <span v-else class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <div class="ku-item-actions">
                  <button type="button" class="btn-pill-primary" @click="startKuEdit('utensil', row.id, row.name)">Edit</button>
                  <button type="button" class="btn-pill-primary" @click="deleteKuRow('utensil', row.id)">Delete</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="ku-empty">No utensils or equipment added yet.</div>
        </div>

        <!-- Helpers/Drivers -->
        <div v-if="kuSubTab === 'helpers'" class="ku-section">
          <div v-if="addingKuType === 'helper_driver'" class="grocery-aisle-card ku-item-card ku-add-card">
            <div class="ku-item-row">
              <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                <input
                  ref="kuAddInputRef"
                  v-model="newHelperDriverName"
                  class="form-section-pill-input ku-cell-input"
                  type="text"
                  placeholder="Helper or driver..."
                  @keyup.enter="commitAddHelperDriver"
                  @blur="onAddHelperBlur"
                  @keyup.escape="cancelAddingKu"
                />
              </div>
            </div>
          </div>
          <div v-if="helpersDriversAvailable.length" class="ku-card-list">
            <div v-for="row in helpersDriversAvailable" :key="row.id" class="grocery-aisle-card ku-item-card">
              <div class="ku-item-row">
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <input
                    ref="kuEditInputRef"
                    v-if="isKuEditing('helper_driver', row.id)"
                    v-model="kuEditing[kuKey('helper_driver', row.id)]"
                    class="form-section-pill-input ku-cell-input"
                    type="text"
                    @blur="saveKuName('helper_driver', row.id)"
                    @keyup.enter="saveKuName('helper_driver', row.id)"
                    @keyup.escape="cancelKuEdit('helper_driver', row.id)"
                  />
                  <span v-else class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <div class="ku-item-actions">
                  <button type="button" class="btn-pill-primary" @click="startKuEdit('helper_driver', row.id, row.name)">Edit</button>
                  <button type="button" class="btn-pill-primary" @click="deleteKuRow('helper_driver', row.id)">Delete</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="ku-empty">No helpers or drivers added yet.</div>
        </div>
      </div>

      <!-- Notifications Tab -->
      <div v-else-if="activeTab === 'notifications'" class="notif-tab">
        <div class="notif-tab-header">
          <span class="notif-tab-header-title">Notifications</span>
          <button
            v-if="notifStore.unreadCount > 0"
            type="button"
            class="btn-pill-secondary"
            @click="notifStore.markAllRead()"
          >Mark all read</button>
        </div>
        <div v-if="!notifStore.notifications.length" class="dashboard-empty">No notifications yet.</div>
        <div v-else class="submissions-list">
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
  </LockOverlay>

  <!-- Grocery lightbox -->
  <Teleport to="body">
    <div v-if="groceryLightboxOpen" class="grocery-lightbox-overlay" @click.self="closeGroceryLightbox">
      <div class="grocery-lightbox-window">
        <button class="btn-pill-primary grocery-lightbox-close" aria-label="Close" @click="closeGroceryLightbox">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <img :src="groceryLightboxSrc!" :alt="groceryLightboxAlt" class="grocery-lightbox-img" />
      </div>
    </div>
  </Teleport>
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
  background-color: var(--color-lafayette-red, #6b0f2a);
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
  color: var(--color-lafayette-red, #6b0f2a);
  border-color: #fff;
}

.dashboard-subtab-active:hover {
  background-color: #fff;
  color: var(--color-lafayette-red, #6b0f2a);
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
  overflow-y: scroll;
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
  grid-template-columns: minmax(0, 2fr) repeat(6, 1fr) 2rem;
  gap: 0.75rem;
  align-items: center;
}

.submission-table-header {
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  border-radius: 1rem;
  padding: 0.5rem 1.5rem;
  min-height: 3.75rem;
  margin-bottom: 1.75rem; /* same gap as between main tab bar and body (0.75rem + 1rem) */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
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
  color: #000;
  transition: opacity 0.15s;
}

.submission-row:hover {
  opacity: 0.85;
}

/* Col 1: pill structure styles */
.submission-bar {
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
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
  flex: 1;
  min-width: 0;
}

.submission-dish-pill .form-section-pill-input {
  width: 100%;
  min-width: 0;
  min-height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
}

.submission-dish-text {
  display: block;
  min-width: 0;
  white-space: normal;
  word-break: break-word;
  color: #000 !important;
  -webkit-text-fill-color: #000;
}

.submission-dish-placeholder {
  color: var(--color-lafayette-gray, #3c373c) !important;
  -webkit-text-fill-color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.5;
}

/* Col 7: expand arrow — pushed to the far right of the row */
.sub-col-arrow {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.82;
  transition: transform 0.2s;
}

.sub-col-arrow-open {
  transform: rotate(180deg);
}

.submission-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.15);
}

.submission-detail-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.submission-detail-section-title {
  align-self: flex-start;
}

.submission-detail-meta {
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 1rem;
  font-size: var(--body-font-size, 1.125rem);
}

.submission-detail-meta-grid {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.75rem 3.5rem;
  overflow-x: auto;
}

.submission-detail-meta-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
  flex-shrink: 0;
}

.submission-detail-meta-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  flex: 0 0 auto;
}

.submission-detail-meta-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-lafayette-gray, #3c373c);
  text-align: center;
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

.submission-detail-ingredients {
  flex: none;
  min-height: 0;
  padding: 0.5rem 0;
}

.submission-detail-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.submission-detail-actions {
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

/* Grocery: store tab bar above Aisles (spacing matches submission-table-header, width fits content like dashboard-subtab-bar) */
.grocery-store-bar {
  flex: none;
  align-self: flex-start;
  width: fit-content;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  border-radius: 1rem;
  padding: 0.5rem 1.5rem;
  min-height: 3.75rem;
  margin-bottom: 1.75rem; /* same total gap as between main tab bar and this bar (0.75rem + 1rem) */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}

.grocery-store-tab {
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

.grocery-store-tab-active {
  background-color: #fff;
  color: var(--color-lafayette-red, #6b0f2a);
  border-color: #fff;
}

.grocery-store-tab-inactive {
  background-color: transparent;
  color: rgba(255, 255, 255, 0.88);
}

.grocery-store-tab-inactive:hover {
  background-color: rgba(255, 255, 255, 0.18);
  color: #fff;
}

/* Grocery: collapsible aisle cards + white product rows */
.grocery-sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.grocery-aisle-card {
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
  overflow: visible;
  box-shadow: var(--shadow-natural, 6px 6px 9px rgba(0, 0, 0, 0.2));
}

.grocery-aisle-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0.6rem 2rem 0.6rem 1rem;
  border: 1px solid transparent;
  background: none;
  cursor: pointer;
  font-size: inherit;
  color: #000;
  transition: opacity 0.15s;
}

.grocery-aisle-header:hover {
  opacity: 0.85;
}

.grocery-aisle-name-col {
  flex: none;
  display: flex;
  align-items: center;
}

.grocery-aisle-dish-pill {
  flex: none;
}

/* Match submission-dish-pill height and styling (same min-height and no extra padding on input) */
.grocery-aisle-dish-pill .form-section-pill-input {
  width: 100%;
  min-width: 0;
  min-height: 2.25rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
}

.grocery-aisle-dish-text {
  display: block;
  min-width: 0;
  white-space: nowrap;
  color: #000 !important;
  -webkit-text-fill-color: #000;
  font-weight: 500;
}

.grocery-aisle-header-spacer {
  flex: 1;
}

.grocery-aisle-header-label {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-lafayette-gray, #3c373c);
}

.grocery-aisle-header-val {
  font-weight: 400;
}

.grocery-aisle-header-actions {
  align-self: center;
}

.grocery-aisle-arrow {
  position: absolute;
  right: 0.5rem;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  color: var(--color-lafayette-gray, #3c373c);
  opacity: 0.82;
  transition: transform 0.2s;
}

.grocery-aisle-arrow-open {
  transform: rotate(180deg);
}

.grocery-aisle-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem 1rem;
}



/* Product rows — white card style matching IngredientRow */
.grocery-product-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s, border-color 0.15s, background-color 0.15s, opacity 0.15s;
}

.grocery-product-row:hover {
  background: #fafafa;
  border-color: #d5d5d5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.grocery-product-row-checked {
  opacity: 0.6;
}

.grocery-product-checkbox-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
}

.grocery-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: var(--color-lafayette-red, #6b0f2a);
}

.grocery-thumb-clickable {
  cursor: zoom-in;
}

.grocery-product-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.grocery-product-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a1a1a;
}

.grocery-product-size {
  font-size: 0.9375rem;
  color: #666;
}

.grocery-product-dietary {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.grocery-product-teams {
  font-size: 0.875rem;
  color: var(--color-lafayette-gray, #3c373c);
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.grocery-product-price {
  font-size: 1.5rem;
  color: var(--color-lafayette-gray, #3c373c);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 4.5rem;
  text-align: right;
}

.grocery-product-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: none;
  align-self: stretch;
  border-left: 1px solid rgba(0, 0, 0, 0.15);
  padding-left: 1rem;
}

.grocery-product-actions .qty-num {
  min-width: 2.5rem;
}

.grocery-grand-total {
  margin-top: 1rem;
}

.grocery-grand-total-header {
  cursor: default;
}

.grocery-grand-total-header:hover {
  opacity: 1;
}

/* Grocery lightbox */
.grocery-lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.grocery-lightbox-window {
  position: relative;
  display: inline-flex;
}

.grocery-lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 0.5rem;
  pointer-events: none;
  user-select: none;
  display: block;
}

.grocery-lightbox-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  min-height: unset;
  border-radius: 50%;
  font-size: 1rem;
  z-index: 1;
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


/* Notifications tab */
.notif-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notif-tab-header {
  background: var(--color-lafayette-red, #6b0f2a);
  color: #fff;
  border-radius: 1rem;
  padding: 0.5rem 1.5rem;
  min-height: 3.75rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.notif-tab-header-title {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
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
  background: var(--color-lafayette-red, #6b0f2a);
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
  color: #000 !important;
  white-space: normal;
  word-break: break-word;
}

.kitchen-cell *,
.kitchen-cell .kitchen-cell-inner-editable,
.kitchen-cell .kitchen-cell-inner-editable span {
  color: #000 !important;
}

.kitchen-cell-editable {
  overflow: visible;
  cursor: default;
}

.kitchen-cell-editable:hover {
  cursor: text;
}

.kitchen-cell-inner-editable {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000 !important;
}

.kitchen-resource-pill {
  margin: 0;
}

.kitchen-cell-active {
  /* no visual box — input appears inline, seamless */
}

.kitchen-cell-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  font-size: inherit;
  font-family: inherit;
  font-weight: inherit;
  padding: 0;
  line-height: 1.4;
  color: #000;
  text-align: center;
}

/* ─── Kitchens & Utensils tab (tab bar + card rows) ──────────────────────── */

.ku-tab {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ku-tab-bar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}
.ku-tab-bar-row .grocery-store-bar {
  flex: none;
}
.ku-tab-bar-row .ku-add-btn {
  margin-left: auto;
  min-width: 2.5rem;
}

.ku-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Row inside card: same padding/gap as grocery-aisle-header and submission row */
.ku-item-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  padding: 0.6rem 2rem 0.6rem 1rem;
  border: 1px solid transparent;
  background: none;
  font-size: inherit;
  color: #000;
}

.ku-item-pill {
  flex: none;
  max-width: 100%;
}

.ku-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ku-cell-input {
  width: 100%;
  min-width: 0;
}

.ku-item-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  margin-left: auto;
}

.ku-add-card .ku-item-pill {
  min-width: 12rem;
}
.ku-add-card .ku-cell-input {
  min-width: 10rem;
}

.ku-card-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ku-empty {
  padding: 1rem;
  font-size: 0.95rem;
  opacity: 0.75;
  text-align: center;
  background: var(--color-menu-gray, #e5e3e0);
  border-radius: 1rem;
}
</style>
