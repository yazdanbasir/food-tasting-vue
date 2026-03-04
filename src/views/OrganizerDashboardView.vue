<script setup lang="ts">
import '@/styles/form-section.css'
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import type { Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createConsumer } from '@rails/actioncable'
import IngredientThumb from '@/components/IngredientThumb.vue'
import IngredientRow from '@/components/IngredientRow.vue'
import DietaryIcons from '@/components/DietaryIcons.vue'
import { DIETARY_FLAGS, type DietaryFlagKey } from '@/data/dietaryFlags'
import { Plus, X } from 'lucide-vue-next'
import KitchenResourceSelect from '@/components/KitchenResourceSelect.vue'
import KitchenResourceMultiSelect from '@/components/KitchenResourceMultiSelect.vue'
import { getAllSubmissions, updateSubmission, type SubmissionResponse } from '@/api/submissions'
import { getGroceryList, checkGroceryItem, updateGroceryQuantity, updateSubmissionIngredientQuantity, deleteSubmission, updateKitchenAllocation, getKitchenResources, createKitchenResource, updateKitchenResource, deleteKitchenResource, masterListCheckNotify, type GroceryListResponse, type GroceryItem, type KitchenAllocationPayload, type KitchenResourceItem } from '@/api/organizer'
import LockOverlay from '@/components/LockOverlay.vue'
import { useLockOverlay } from '@/composables/useLockOverlay'
import { COUNTRIES, flagEmoji } from '@/data/countries'
import { useSubmissionStore } from '@/stores/submission'
import { useNotificationStore } from '@/stores/notifications'
import { aggregateDietary, notifRelativeTime, notifDotColor } from '@/utils/submission'
import type { NotificationItem } from '@/api/notifications'
import type { Ingredient, IngredientDietary } from '@/types/ingredient'
import { usePlacardExport } from '@/composables/usePlacardExport'
import { toIngredient, formatUtensilsNotes, formatUtensilsNotesLines, formatUtensilsNotesStructured, parseUtensilsNotes, parseOtherIngredients, parseOtherIngredientQuantity, getOtherIngredientUnit, submissionPhoneNumbers, formatAisleTitle, countryLabel, EMPTY_DIETARY, otherEntryToIngredient } from '@/utils/organizer'

const router = useRouter()
const route = useRoute()
const submissionStore = useSubmissionStore()
const notifStore = useNotificationStore()
const { isLocked } = useLockOverlay()
const isStudentLookupOnly = computed(() => route.query.mode === 'student-edit')

// Re-load kitchen resources after the organizer unlocks, since onMounted runs
// before auth and the first attempt silently fails (401, no token yet).
watch(isLocked, (locked) => {
  if (!locked) loadKitchenResources()
})



/** Aggregated equipment master list: name (utensil), subline (size), quantity */
function aggregatedEquipmentList(): { name: string; subline: string; quantity: number }[] {
  const byKey = new Map<string, { name: string; subline: string; quantity: number }>()
  for (const sub of submissions.value) {
    if (sub.needs_utensils !== true) continue
    for (const entry of parseUtensilsNotes(sub.utensils_notes)) {
      const key = `${entry.utensil}|${entry.size}`
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity += entry.quantity
      } else {
        byKey.set(key, {
          name: entry.utensil,
          subline: entry.size || '',
          quantity: entry.quantity,
        })
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name) || a.subline.localeCompare(b.subline))
}

const equipmentMasterList = computed(() => aggregatedEquipmentList())

/** Aggregated Other Stores master list: name (item), subline (size · additionalDetails), quantity */
function aggregatedOtherStoresList(): { name: string; subline: string; quantity: number }[] {
  const byKey = new Map<string, { name: string; subline: string; quantity: number }>()
  for (const sub of submissions.value) {
    for (const entry of parseOtherIngredients(sub)) {
      const key = `${entry.item}|${entry.size}|${entry.additionalDetails}`
      const subline = [entry.size, entry.additionalDetails].filter(Boolean).join(' · ')
      const qty = Math.max(0, parseOtherIngredientQuantity(entry.quantity))
      const existing = byKey.get(key)
      if (existing) {
        existing.quantity += qty
      } else {
        byKey.set(key, {
          name: entry.item || '—',
          subline,
          quantity: qty,
        })
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name) || a.subline.localeCompare(b.subline))
}

const otherStoresMasterList = computed(() => aggregatedOtherStoresList())



const activeTab = ref<'submissions' | 'grocery' | 'kitchens' | 'placards' | 'notifications'>('submissions')
const groceryStore = ref<'giant' | 'other-stores' | 'utensils-equipment'>('giant') // tab bar: Giant | Other Stores | Utensils/Equipment
/** Giant tab only: show list by aisle (default) or as one flat full list */
const giantViewMode = ref<'by-aisle' | 'full-list'>('by-aisle')
/** Tab inside each submission detail card: Giant vs Other Stores, tracked per submission id */
const submissionDetailStoreTabById = ref<Record<number, 'giant' | 'other-stores'>>({})
const kuSubTab = ref<'fridges' | 'kitchens' | 'utensils' | 'helpers'>('fridges') // Kitchens & Utensils sub-tabs
const addingKuType = ref<'fridge' | 'kitchen' | 'utensil' | 'helper_driver' | null>(null) // show add-card with input
const kuAddInputRef = ref<HTMLInputElement | null>(null)
const submissions = ref<SubmissionResponse[]>([])
const groceryList = ref<GroceryListResponse | null>(null)
const selectedPlacardIds = ref<Set<number>>(new Set())
const { isExporting, exportProgress, exportPDF, exportPNG } = usePlacardExport()
const expandedSubmissions = ref<Set<number>>(new Set())

function getSubmissionDetailStoreTab(subId: number): 'giant' | 'other-stores' {
  return submissionDetailStoreTabById.value[subId] ?? 'giant'
}

function setSubmissionDetailStoreTab(subId: number, tab: 'giant' | 'other-stores') {
  submissionDetailStoreTabById.value = {
    ...submissionDetailStoreTabById.value,
    [subId]: tab,
  }
}

const editPlacardFlagsMode = ref(false)
const placardDietaryOverrides = ref<Record<number, IngredientDietary>>({})
const openAddDropdownForSubId = ref<number | null>(null)
const addDropdownAnchorRef = ref<HTMLElement | null>(null)
const placardAddDropdownRef = ref<HTMLElement | null>(null)
const addDropdownStyle = ref<Record<string, string>>({})

function getEffectivePlacardDietary(sub: SubmissionResponse): IngredientDietary {
  const overrides = placardDietaryOverrides.value[sub.id]
  if (overrides) return overrides
  return aggregateDietary(sub)
}

function removePlacardFlag(subId: number, key: DietaryFlagKey) {
  const sub = submissions.value.find((s) => s.id === subId)
  if (!sub) return
  const effective = getEffectivePlacardDietary(sub)
  placardDietaryOverrides.value = {
    ...placardDietaryOverrides.value,
    [subId]: { ...effective, [key]: false },
  }
}

function addPlacardFlag(subId: number, key: DietaryFlagKey) {
  const sub = submissions.value.find((s) => s.id === subId)
  if (!sub) return
  const effective = getEffectivePlacardDietary(sub)
  placardDietaryOverrides.value = {
    ...placardDietaryOverrides.value,
    [subId]: { ...effective, [key]: true },
  }
  openAddDropdownForSubId.value = null
}

function openAddDropdown(subId: number, anchorEl: HTMLElement) {
  openAddDropdownForSubId.value = subId
  addDropdownAnchorRef.value = anchorEl
  nextTick(() => {
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect()
      addDropdownStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
      }
    }
  })
}

function closeAddDropdown() {
  openAddDropdownForSubId.value = null
  addDropdownAnchorRef.value = null
}

function handlePlacardDropdownClickOutside(e: MouseEvent) {
  if (openAddDropdownForSubId.value == null) return
  const target = e.target as Node
  if (placardAddDropdownRef.value?.contains(target)) return
  if (addDropdownAnchorRef.value?.contains(target)) return
  closeAddDropdown()
}

watch(openAddDropdownForSubId, (open) => {
  if (open) {
    nextTick(() => document.addEventListener('click', handlePlacardDropdownClickOutside))
  } else {
    document.removeEventListener('click', handlePlacardDropdownClickOutside)
  }
})

onUnmounted(() => document.removeEventListener('click', handlePlacardDropdownClickOutside))

const placardAddDropdownFlags = computed(() => {
  const subId = openAddDropdownForSubId.value
  if (subId == null) return []
  const sub = submissions.value.find((s) => s.id === subId)
  if (!sub) return []
  const effective = getEffectivePlacardDietary(sub)
  return DIETARY_FLAGS.filter((f) => !effective[f.key])
})

const placardRows = computed(() =>
  submissions.value.map((sub) => {
    const dietary = getEffectivePlacardDietary(sub)
    const hasDietary = Object.values(dietary).some(Boolean)
    return { sub, dietary, hasDietary }
  })
)

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

/** Checked keys for master list tabs (Other Stores / Utensils) — key = `${name}|${subline}` */
const checkedOtherStoresKeys = ref<Set<string>>(new Set())
const checkedEquipmentKeys = ref<Set<string>>(new Set())

function masterListKey(item: { name: string; subline: string }): string {
  return `${item.name}|${item.subline}`
}

function isMasterListChecked(type: 'other-stores' | 'utensils-equipment', key: string): boolean {
  return type === 'other-stores' ? checkedOtherStoresKeys.value.has(key) : checkedEquipmentKeys.value.has(key)
}

function toggleMasterListCheck(
  type: 'other-stores' | 'utensils-equipment',
  key: string,
  label: string,
) {
  const isOtherStores = type === 'other-stores'
  const set = isOtherStores ? checkedOtherStoresKeys.value : checkedEquipmentKeys.value
  const newChecked = !set.has(key)

  if (isOtherStores) {
    const next = new Set(checkedOtherStoresKeys.value)
    if (newChecked) next.add(key)
    else next.delete(key)
    checkedOtherStoresKeys.value = next
  } else {
    const next = new Set(checkedEquipmentKeys.value)
    if (newChecked) next.add(key)
    else next.delete(key)
    checkedEquipmentKeys.value = next
  }

  const apiListType = isOtherStores ? 'other_stores' : 'utensils_equipment'
  void masterListCheckNotify(apiListType, label, newChecked)
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
    const first = submissions.value[0]
    const pending = submissionStore.pendingOrganizerMerge
    if (pending) {
      const idx = submissions.value.findIndex((s) => s.id === pending.id)
      if (idx !== -1) submissions.value[idx] = pending
      submissionStore.setPendingOrganizerMerge(null)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load'
  } finally {
    isLoading.value = false
  }
}

async function loadGroceryList() {
  const isFirstLoad = !groceryList.value
  isLoading.value = true
  error.value = null
  try {
    groceryList.value = await getGroceryList()
    // Default all aisles to collapsed on first load only (not on WebSocket reloads)
    if (isFirstLoad) expandedAisles.value = new Set()
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

function switchToPlacards() {
  activeTab.value = 'placards'
  addProductError.value = null
  selectedPlacardIds.value = new Set()
}

function togglePlacardSelection(id: number) {
  const next = new Set(selectedPlacardIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedPlacardIds.value = next
}

function toggleAllPlacards() {
  if (selectedPlacardIds.value.size === submissions.value.length) {
    selectedPlacardIds.value = new Set()
  } else {
    selectedPlacardIds.value = new Set(submissions.value.map((s) => s.id))
  }
}

function handleExportPDF() {
  const selected = submissions.value.filter((s) => selectedPlacardIds.value.has(s.id))
  exportPDF(selected, placardDietaryOverrides.value)
}

function handleExportPNG() {
  const selected = submissions.value.filter((s) => selectedPlacardIds.value.has(s.id))
  exportPNG(selected, placardDietaryOverrides.value)
}

function switchToNotifications() {
  activeTab.value = 'notifications'
  addProductError.value = null
  notifStore.load()
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

/** Build submission payload for PATCH (only other_ingredients is updated when changing other-store qty) */
function submissionToPayload(sub: SubmissionResponse): Parameters<typeof updateSubmission>[1] {
  return {
    team_name: sub.team_name,
    dish_name: sub.dish_name,
    notes: sub.notes ?? undefined,
    country_code: sub.country_code ?? undefined,
    members: sub.members ?? [],
    phone_number: sub.phone_number ?? undefined,
    has_cooking_place: sub.has_cooking_place ?? undefined,
    cooking_location: sub.cooking_location ?? undefined,
    found_all_ingredients: sub.found_all_ingredients ?? undefined,
    other_ingredients: sub.other_ingredients ?? undefined,
    needs_fridge_space: sub.needs_fridge_space ?? undefined,
    dish_temperature: sub.dish_temperature ?? undefined,
    dish_description: sub.dish_description ?? undefined,
    allergen: sub.allergen ?? undefined,
    needs_utensils: sub.needs_utensils ?? undefined,
    utensils_notes: sub.utensils_notes ?? undefined,
    ingredients: (sub.ingredients ?? []).map((item) => ({
      ingredient_id: item.ingredient.id,
      quantity: item.quantity,
    })),
  }
}

async function handleOtherIngredientQty(
  sub: SubmissionResponse,
  entryIndex: number,
  currentQty: number,
  delta: number,
) {
  const newQty = Math.max(0, currentQty + delta)
  addProductError.value = null
  const entries = parseOtherIngredients(sub)
  if (entryIndex < 0 || entryIndex >= entries.length) return
  const unit = getOtherIngredientUnit(entries[entryIndex]!.quantity)
  const newQuantityStr = unit ? `${newQty} ${unit}` : String(newQty)
  const updated = entries.map((e, i) =>
    i === entryIndex ? { ...e, quantity: newQuantityStr } : e
  )
  const otherIngredientsJson = JSON.stringify(
    updated.map((e) => ({
      item: e.item,
      size: e.size,
      quantity: e.quantity,
      ...(e.additionalDetails ? { additionalDetails: e.additionalDetails } : {}),
    }))
  )
  try {
    const payload = submissionToPayload(sub)
    await updateSubmission(sub.id, { ...payload, other_ingredients: otherIngredientsJson })
    await loadSubmissions()
  } catch (err) {
    addProductError.value = err instanceof Error ? err.message : 'Failed to update quantity'
  }
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

/** All Giant items in one array (for Full List view) */
const giantAllItems = computed(() => {
  if (!groceryList.value) return []
  return Object.values(groceryList.value.aisles).flat()
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

// Full edit form in expanded section (name, point_person, phone, driver for helpers)
const editingKuCard = ref<{ kind: KuListKind; id: number } | null>(null)
const kuEditForm = ref<{ name: string; point_person: string; phone: string; is_driver: boolean | null }>({
  name: '',
  point_person: '',
  phone: '',
  is_driver: null,
})

function isKuCardEditing(kind: KuListKind, row: KitchenResourceItem) {
  const c = editingKuCard.value
  return c !== null && c.kind === kind && c.id === row.id
}

async function startKuEdit(kind: KuListKind, row: KitchenResourceItem) {
  kuEditError.value = null
  editingKuCard.value = { kind, id: row.id }
  kuEditForm.value = {
    name: row.name,
    point_person: (row.point_person ?? '').trim(),
    phone: (row.phone ?? '').trim(),
    is_driver: row.is_driver ?? null,
  }
  const key = kuCardKey(kind, row.id)
  if (!expandedKuCards.value.has(key)) {
    expandedKuCards.value = new Set([...expandedKuCards.value, key])
  }
  await nextTick()
  // Find the visible edit form (v-show hides inactive ones with display:none) and focus its first input
  for (const el of document.querySelectorAll<HTMLElement>('.ku-card-edit-form')) {
    if (el.style.display !== 'none') {
      el.querySelector<HTMLInputElement>('.ku-card-edit-input')?.focus()
      break
    }
  }
}

function cancelKuEditForm() {
  editingKuCard.value = null
  kuEditError.value = null
}

const driverSelectValue = computed({
  get: () => {
    const v = kuEditForm.value.is_driver
    return v === true ? 'yes' : v === false ? 'no' : ''
  },
  set: (val: string) => {
    kuEditForm.value.is_driver = val === 'yes' ? true : val === 'no' ? false : null
  },
})

const kuEditError = ref<string | null>(null)
const kuSaving = ref(false)

async function saveKuEdit() {
  const c = editingKuCard.value
  if (!c || kuSaving.value) return
  kuEditError.value = null
  const { name, point_person, phone, is_driver } = kuEditForm.value
  const trimmedName = name.trim()
  if (!trimmedName) return
  const payload: Parameters<typeof updateKitchenResource>[1] = {
    name: trimmedName,
    phone: phone.trim() || null,
  }
  if (c.kind !== 'helper_driver') {
    payload.point_person = point_person.trim() || null
  }
  if (c.kind === 'helper_driver') {
    payload.is_driver = is_driver
  }
  kuSaving.value = true
  try {
    const updated = await updateKitchenResource(c.id, payload)
    // Update local list with server-confirmed data
    const listRef = kuListRef(c.kind)
    const idx = listRef.value.findIndex((row) => row.id === c.id)
    if (idx >= 0) {
      const previous = listRef.value[idx] as KitchenResourceItem
      const merged: KitchenResourceItem = {
        ...previous,
        ...updated,
      }
      if ('phone' in payload && updated.phone === undefined) merged.phone = payload.phone ?? null
      if ('point_person' in payload && updated.point_person === undefined) merged.point_person = payload.point_person ?? null
      if ('is_driver' in payload && updated.is_driver === undefined) merged.is_driver = payload.is_driver ?? null
      listRef.value[idx] = merged
      if (
        ('phone' in payload && updated.phone === undefined) ||
        ('point_person' in payload && updated.point_person === undefined) ||
        ('is_driver' in payload && updated.is_driver === undefined)
      ) {
        // backend response missing edited contact fields; likely outdated backend deploy or missing migration
      }
    }
    editingKuCard.value = null
  } catch (err) {
    kuEditError.value = err instanceof Error ? err.message : 'Failed to save. Run backend migration: cd backend && bundle exec rails db:migrate'
  } finally {
    kuSaving.value = false
  }
}

function kuListRef(kind: KuListKind): Ref<KitchenResourceItem[]> {
  if (kind === 'kitchen') return kitchensAvailable
  if (kind === 'utensil') return utensilsAvailable
  if (kind === 'helper_driver') return helpersDriversAvailable
  return fridgesAvailable
}

function addKitchenRow() {
  const name = newKitchenName.value.trim()
  if (!name) return
  createKitchenResource({ kind: 'kitchen', name })
    .then((created) => {
      kitchensAvailable.value = [created, ...kitchensAvailable.value]
      newKitchenName.value = ''
      addingKuType.value = null
      startKuEdit('kitchen', created)
    })
    .catch((err) => {
      console.error(err)
    })
}

function addFridgeRow() {
  const name = newFridgeName.value.trim()
  if (!name) return
  createKitchenResource({ kind: 'fridge', name })
    .then((created) => {
      fridgesAvailable.value = [created, ...fridgesAvailable.value]
      newFridgeName.value = ''
      addingKuType.value = null
      startKuEdit('fridge', created)
    })
    .catch((err) => {
      console.error(err)
    })
}

function addUtensilRow() {
  const name = newUtensilName.value.trim()
  if (!name) return
  createKitchenResource({ kind: 'utensil', name })
    .then((created) => {
      utensilsAvailable.value = [created, ...utensilsAvailable.value]
      newUtensilName.value = ''
      addingKuType.value = null
      startKuEdit('utensil', created)
    })
    .catch((err) => {
      console.error(err)
    })
}

function addHelperDriverRow() {
  const name = newHelperDriverName.value.trim()
  if (!name) return
  createKitchenResource({ kind: 'helper_driver', name })
    .then((created) => {
      helpersDriversAvailable.value = [created, ...helpersDriversAvailable.value]
      newHelperDriverName.value = ''
      addingKuType.value = null
      startKuEdit('helper_driver', created)
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

// ─── KU cards expand/collapse + debug info ─────────────────────────────────
const expandedKuCards = ref<Set<string>>(new Set())
function kuCardKey(kind: KuListKind, id: number): string {
  return `${kind}-${id}`
}
function toggleKuCardExpanded(kind: KuListKind, id: number) {
  const key = kuCardKey(kind, id)
  const next = new Set(expandedKuCards.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedKuCards.value = next
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
  if (editingKuCard.value && editingKuCard.value.kind === kind && editingKuCard.value.id === id) {
    cancelKuEditForm()
  }
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
    // loadKitchenResources failed silently
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

/** Options for equipment multi-select including any allocated values so they always display. */
function equipmentOptionsForSelect(sub: SubmissionResponse): string[] {
  const options = equipmentOptionsFor(sub)
  const allocated = parseEquipmentAllocated(sub.equipment_allocated)
  const extra = allocated.filter((v) => !options.includes(v))
  return extra.length ? [...extra, ...options] : options
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

/** Options for fridge select including submitted value so it always displays. */
function fridgeOptionsForSelect(sub: SubmissionResponse): string[] {
  const options = fridgeOptionsFor(sub)
  const val = (sub.fridge_location || '').trim()
  if (val && !options.includes(val)) return [val, ...options]
  return options
}

/** Options for kitchen select including submitted value so it always displays. */
function kitchenOptionsForSelect(sub: SubmissionResponse): string[] {
  const options = kitchenOptionsFor(sub)
  const val = (sub.cooking_location || '').trim()
  if (val && !options.includes(val)) return [val, ...options]
  return options
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

/** Options for helper select including submitted value so it always displays. */
function helperOptionsForSelect(sub: SubmissionResponse): string[] {
  const options = helperOptions(sub)
  const val = (sub.helper_driver_needed || '').trim()
  if (val && !options.includes(val)) return [val, ...options]
  return options
}

</script>

<template>
  <LockOverlay :allow-password="!isStudentLookupOnly">
  <div class="md:h-full flex flex-col dashboard">
    <!-- Tab bar row: maroon pill bar + (when Notifications) Mark all read outside bar, far right -->
    <div class="dashboard-subtab-bar-row">
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
            :class="activeTab === 'placards' ? 'dashboard-subtab-active' : 'dashboard-subtab-inactive'"
            @click="switchToPlacards"
          >
            Placards
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
      <button
        v-if="activeTab === 'notifications' && notifStore.unreadCount > 0"
        type="button"
        class="btn-pill-primary dashboard-notif-mark-read"
        @click="notifStore.markAllRead()"
      >
        Mark all read
      </button>
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
            <div class="sub-header-cell sub-header-center">Kitchen</div>
            <div class="sub-header-cell sub-header-center">Fridge</div>
            <div class="sub-header-cell sub-header-center">Equipment</div>
            <div class="sub-header-cell sub-header-center">Allocated</div>
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
                  <span class="submission-country-display" :title="countryLabel(sub.country_code, sub.country_name)">{{ sub.country_code === 'OTHER' ? '🏳️' : (sub.country_code ? flagEmoji(sub.country_code) : '🏳️') }}</span>
                </div>
                <div class="form-section-pill submission-dish-pill">
                  <span class="form-section-pill-input submission-dish-text" :class="{ 'submission-dish-placeholder': !sub.dish_name }">{{ sub.dish_name || 'dish name...' }}</span>
                </div>
              </div>

              <!-- Col 2: Members (one per line) -->
              <div class="kitchen-cell kitchen-cell-members">
                <template v-if="(sub.members || []).length">
                  <span v-for="(m, i) in (sub.members || [])" :key="i" class="kitchen-cell-member">{{ m }}</span>
                </template>
                <span v-else>—</span>
              </div>

              <!-- Col 3: Kitchen / Location (editable) -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <template v-if="sub.has_cooking_place === false">
                  <div class="form-section-pill kitchen-resource-pill">
                    <KitchenResourceSelect
                      :model-value="(sub.cooking_location || '').trim() || null"
                      :options="kitchenOptionsForSelect(sub)"
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
                    <span v-else>{{ (sub.cooking_location || '').trim() || '—' }}</span>
                  </div>
                </template>
              </div>

              <!-- Col 4: Fridge -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <template v-if="sub.needs_fridge_space === true">
                  <div class="form-section-pill kitchen-resource-pill">
                    <KitchenResourceSelect
                      :model-value="(sub.fridge_location || '').trim() || null"
                      :options="fridgeOptionsForSelect(sub)"
                      placeholder="Assign fridge"
                      clearable
                      @update:model-value="(val) => assignKitchenField(sub, 'fridge_location', val)"
                    />
                  </div>
                </template>
                <template v-else>
                  <span>—</span>
                </template>
              </div>

              <!-- Col 5: Equipment Requested (read-only, one per line: name + details on next line in smaller print) -->
              <div class="kitchen-cell kitchen-cell-equipment">
                <template v-if="sub.needs_utensils === true && formatUtensilsNotesStructured(sub.utensils_notes).length">
                  <div v-for="(item, i) in formatUtensilsNotesStructured(sub.utensils_notes)" :key="i" class="kitchen-cell-equipment-line">
                    <span class="kitchen-cell-equipment-name">{{ item.name }}</span>
                    <span v-if="item.details" class="kitchen-cell-equipment-details">({{ item.details }})</span>
                  </div>
                </template>
                <span v-else-if="sub.needs_utensils === true">Needs utensils</span>
                <span v-else>—</span>
              </div>

              <!-- Col 6: Equipment Allocated (editable) -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <template v-if="sub.needs_utensils === true">
                  <div class="form-section-pill kitchen-resource-pill">
                    <KitchenResourceMultiSelect
                      :model-value="parseEquipmentAllocated(sub.equipment_allocated)"
                      :options="equipmentOptionsForSelect(sub)"
                      placeholder="Assign equipment"
                      @update:model-value="(vals) => assignEquipmentMulti(sub, vals)"
                    />
                  </div>
                </template>
                <span v-else>—</span>
              </div>

              <!-- Col 7: Helper / Driver? (Assign helper dropdown) -->
              <div class="kitchen-cell kitchen-cell-editable" @click.stop>
                <div class="form-section-pill kitchen-resource-pill">
                  <KitchenResourceSelect
                    :model-value="(sub.helper_driver_needed || '').trim() || null"
                    :options="helperOptionsForSelect(sub)"
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
                  <div class="submission-detail-meta-left submission-detail-meta-col-1">
                    <div class="submission-detail-meta-item submission-detail-meta-dietary-flags">
                      <span class="submission-detail-meta-label">Dietary Tags</span>
                      <DietaryIcons v-if="Object.values(aggregateDietary(sub)).some(Boolean)" :dietary="aggregateDietary(sub)" :size="18" />
                      <span v-else class="submission-detail-meta-value submission-detail-meta-empty">—</span>
                    </div>
                    <div class="submission-detail-meta-item submission-detail-meta-dish-type">
                      <span class="submission-detail-meta-label">Dish Type</span>
                      <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': !sub.dish_temperature }">{{ sub.dish_temperature === 'hot' ? 'Hot' : sub.dish_temperature === 'cold' ? 'Cold' : '—' }}</span>
                    </div>
                    <!-- Ingredients display (commented out for now)
                    <div v-if="sub.found_all_ingredients" class="submission-detail-meta-item submission-detail-meta-ingredients">
                      <span class="submission-detail-meta-label">Ingredients</span>
                      <span class="submission-detail-meta-value">{{ sub.found_all_ingredients ? 'Has Ingredients ✅' : 'Missing Items ⚠️' }}</span>
                    </div>
                    -->
                  </div>
                  <div class="submission-detail-meta-item submission-detail-meta-col-2 submission-detail-meta-phone">
                    <span class="submission-detail-meta-label">Phone</span>
                    <div class="submission-detail-meta-value submission-detail-meta-phone-lines">
                      <template v-if="submissionPhoneNumbers(sub).length">
                        <span v-for="(phone, i) in submissionPhoneNumbers(sub)" :key="i" class="submission-detail-meta-phone-line">{{ phone }}</span>
                      </template>
                      <span v-else class="submission-detail-meta-empty">—</span>
                    </div>
                  </div>
                  <div class="submission-detail-meta-item submission-detail-meta-col-3">
                    <span class="submission-detail-meta-label">Kitchen</span>
                    <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': sub.has_cooking_place == null }">{{ sub.has_cooking_place != null ? (sub.has_cooking_place ? 'Yes ✅' : 'Needed ⚠️') : '—' }}</span>
                  </div>
                  <div v-if="sub.needs_fridge_space" class="submission-detail-meta-item submission-detail-meta-col-4">
                    <span class="submission-detail-meta-label">Fridge</span>
                    <span class="submission-detail-meta-value">{{ sub.needs_fridge_space ? 'Needed ⚠️' : 'No need ✅' }}</span>
                  </div>
                  <div v-if="sub.needs_utensils" class="submission-detail-meta-item submission-detail-meta-col-5">
                    <span class="submission-detail-meta-label">Utensils</span>
                    <span class="submission-detail-meta-value">{{ sub.needs_utensils ? 'Needed ⚠️' : 'No need ✅' }}</span>
                  </div>
                  <div class="submission-detail-meta-actions submission-detail-meta-col-8">
                    <button
                      type="button"
                      class="btn-pill-primary"
                      @click.stop="handleEditSubmission(sub)"
                    >
                      Edit
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
              <div class="submission-detail-meta submission-detail-dish-allergen">
                <div class="submission-detail-dish-allergen-row">
                  <span class="submission-detail-meta-label">Dish Description</span>
                  <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': !sub.dish_description }">{{ sub.dish_description || '—' }}</span>
                </div>
                <div class="submission-detail-dish-allergen-row">
                  <span class="submission-detail-meta-label">Known Allergens</span>
                  <span class="submission-detail-meta-value" :class="{ 'submission-detail-meta-empty': !sub.allergen }">{{ sub.allergen || '—' }}</span>
                </div>
              </div>
              <div class="form-section-ingredients submission-detail-ingredients">
                <div class="submission-detail-store-bar grocery-store-bar">
                  <button
                    type="button"
                    class="grocery-store-tab"
                    :class="getSubmissionDetailStoreTab(sub.id) === 'giant' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
                    @click="setSubmissionDetailStoreTab(sub.id, 'giant')"
                  >
                    Giant
                  </button>
                  <button
                    type="button"
                    class="grocery-store-tab"
                    :class="getSubmissionDetailStoreTab(sub.id) === 'other-stores' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
                    @click="setSubmissionDetailStoreTab(sub.id, 'other-stores')"
                  >
                    Other Stores
                  </button>
                </div>
                <template v-if="getSubmissionDetailStoreTab(sub.id) === 'giant'">
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
                </template>
                <template v-else>
                  <div class="submission-detail-list submission-detail-other-stores-list">
                    <template v-if="parseOtherIngredients(sub).length">
                      <IngredientRow
                        v-for="(entry, i) in parseOtherIngredients(sub)"
                        :key="i"
                        :ingredient="otherEntryToIngredient(entry, i)"
                        :quantity="parseOtherIngredientQuantity(entry.quantity)"
                        :quantity-unit="getOtherIngredientUnit(entry.quantity)"
                        :editable="true"
                        :show-price="false"
                        @change-qty="(delta) => handleOtherIngredientQty(sub, i, parseOtherIngredientQuantity(entry.quantity), delta)"
                      />
                    </template>
                    <div v-else class="submission-detail-other-stores-empty">No items from other stores</div>
                  </div>
                </template>
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
        <!-- Store tab bar + Giant view toggle (separate bar, right-aligned) -->
        <div class="grocery-tab-bar-row">
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
            <button
              type="button"
              class="grocery-store-tab"
              :class="groceryStore === 'utensils-equipment' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="groceryStore = 'utensils-equipment'"
            >
              Utensils/Equipment
            </button>
          </div>
          <div v-if="groceryStore === 'giant'" class="grocery-store-bar grocery-view-mode-bar">
            <button
              type="button"
              class="grocery-store-tab"
              :class="giantViewMode === 'by-aisle' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="giantViewMode = 'by-aisle'"
            >
              By Aisle
            </button>
            <button
              type="button"
              class="grocery-store-tab"
              :class="giantViewMode === 'full-list' ? 'grocery-store-tab-active' : 'grocery-store-tab-inactive'"
              @click="giantViewMode = 'full-list'"
            >
              Full List
            </button>
          </div>
        </div>
        <div v-if="groceryStore === 'other-stores'" class="grocery-sections grocery-utensils-list">
          <div
            v-for="item in otherStoresMasterList"
            :key="masterListKey(item)"
            class="grocery-aisle-card grocery-master-card"
            :class="{ 'grocery-master-card-checked': isMasterListChecked('other-stores', masterListKey(item)) }"
          >
            <label class="grocery-product-checkbox-wrap grocery-master-checkbox-wrap">
              <input
                type="checkbox"
                class="grocery-checkbox"
                :checked="isMasterListChecked('other-stores', masterListKey(item))"
                @change="toggleMasterListCheck('other-stores', masterListKey(item), item.subline ? item.name + ' | ' + item.subline : item.name)"
              />
            </label>
            <div class="grocery-master-card-content">
              <div class="grocery-aisle-header grocery-utensils-row">
                <div class="grocery-aisle-name-col">
                  <div class="form-section-pill grocery-aisle-dish-pill">
                    <span class="form-section-pill-input grocery-aisle-dish-text" :class="{ 'line-through': isMasterListChecked('other-stores', masterListKey(item)) }">{{ item.subline ? `${item.name} | ${item.subline}` : item.name }}</span>
                  </div>
                </div>
                <span class="grocery-aisle-header-spacer"></span>
                <div class="grocery-product-actions grocery-aisle-header-actions">
                  <span class="qty-controls">
                    <span class="tabular-nums qty-num grocery-aisle-header-val">{{ item.quantity }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!otherStoresMasterList.length" class="grocery-utensils-empty">
            No other-store items yet.
          </div>
        </div>
        <div v-if="groceryStore === 'utensils-equipment'" class="grocery-sections grocery-utensils-list">
          <div
            v-for="item in equipmentMasterList"
            :key="masterListKey(item)"
            class="grocery-aisle-card grocery-master-card"
            :class="{ 'grocery-master-card-checked': isMasterListChecked('utensils-equipment', masterListKey(item)) }"
          >
            <label class="grocery-product-checkbox-wrap grocery-master-checkbox-wrap">
              <input
                type="checkbox"
                class="grocery-checkbox"
                :checked="isMasterListChecked('utensils-equipment', masterListKey(item))"
                @change="toggleMasterListCheck('utensils-equipment', masterListKey(item), item.subline ? item.name + ' | ' + item.subline : item.name)"
              />
            </label>
            <div class="grocery-master-card-content">
              <div class="grocery-aisle-header grocery-utensils-row">
                <div class="grocery-aisle-name-col">
                  <div class="form-section-pill grocery-aisle-dish-pill">
                    <span class="form-section-pill-input grocery-aisle-dish-text" :class="{ 'line-through': isMasterListChecked('utensils-equipment', masterListKey(item)) }">{{ item.subline ? `${item.name} | ${item.subline}` : item.name }}</span>
                  </div>
                </div>
                <span class="grocery-aisle-header-spacer"></span>
                <div class="grocery-product-actions grocery-aisle-header-actions">
                  <span class="qty-controls">
                    <span class="tabular-nums qty-num grocery-aisle-header-val">{{ item.quantity }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="!equipmentMasterList.length" class="grocery-utensils-empty">
            No equipment requested yet.
          </div>
        </div>
        <!-- Giant: By Aisle (collapsible aisles) -->
        <div v-if="groceryStore === 'giant' && giantViewMode === 'by-aisle'" class="grocery-sections">
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
                  <span class="qty-btn-stack grocery-aisle-header-qty-placeholder" style="visibility: hidden;">
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
        <!-- Giant: Full List (single flat list) -->
        <div v-if="groceryStore === 'giant' && giantViewMode === 'full-list'" class="grocery-sections">
          <div class="grocery-aisle-card">
            <div class="grocery-aisle-body">
              <div
                v-for="item in giantAllItems"
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
                <span class="qty-btn-stack grocery-aisle-header-qty-placeholder" style="visibility: hidden;">
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
              <button
                type="button"
                class="ku-item-row ku-item-row-toggle"
                @click="toggleKuCardExpanded('fridge', row.id)"
              >
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <span class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <span class="ku-item-arrow" :class="{ 'ku-item-arrow-open': expandedKuCards.has(kuCardKey('fridge', row.id)) }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <div
                v-if="expandedKuCards.has(kuCardKey('fridge', row.id))"
                class="ku-card-detail"
              >
                <div v-show="isKuCardEditing('fridge', row)" class="ku-card-meta ku-card-edit-form">
                  <div v-if="kuEditError" class="ku-edit-error">{{ kuEditError }}</div>
                  <div class="ku-card-edit-fields">
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Name</label>
                      <input v-model="kuEditForm.name" class="ku-card-edit-input" type="text" placeholder="Name" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Point Person</label>
                      <input v-model="kuEditForm.point_person" class="ku-card-edit-input" type="text" placeholder="Point person" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Phone</label>
                      <input v-model="kuEditForm.phone" class="ku-card-edit-input" type="text" placeholder="Phone" />
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="saveKuEdit">{{ kuSaving ? 'Saving…' : 'Save' }}</button>
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="cancelKuEditForm">Cancel</button>
                    </div>
                  </div>
                </div>
                <div v-show="!isKuCardEditing('fridge', row)" class="ku-card-meta">
                  <div class="ku-card-meta-grid">
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Point Person</span>
                      <span class="ku-card-meta-value">{{ (row.point_person || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Phone</span>
                      <span class="ku-card-meta-value">{{ (row.phone || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" @click.stop="startKuEdit('fridge', row)">Edit</button>
                      <button type="button" class="btn-pill-primary" @click.stop="deleteKuRow('fridge', row.id)">Delete</button>
                    </div>
                  </div>
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
              <button
                type="button"
                class="ku-item-row ku-item-row-toggle"
                @click="toggleKuCardExpanded('kitchen', row.id)"
              >
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <span class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <span class="ku-item-arrow" :class="{ 'ku-item-arrow-open': expandedKuCards.has(kuCardKey('kitchen', row.id)) }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <div
                v-if="expandedKuCards.has(kuCardKey('kitchen', row.id))"
                class="ku-card-detail"
              >
                <div v-show="isKuCardEditing('kitchen', row)" class="ku-card-meta ku-card-edit-form">
                  <div v-if="kuEditError" class="ku-edit-error">{{ kuEditError }}</div>
                  <div class="ku-card-edit-fields">
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Name</label>
                      <input v-model="kuEditForm.name" class="ku-card-edit-input" type="text" placeholder="Name" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Point Person</label>
                      <input v-model="kuEditForm.point_person" class="ku-card-edit-input" type="text" placeholder="Point person" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Phone</label>
                      <input v-model="kuEditForm.phone" class="ku-card-edit-input" type="text" placeholder="Phone" />
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="saveKuEdit">{{ kuSaving ? 'Saving…' : 'Save' }}</button>
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="cancelKuEditForm">Cancel</button>
                    </div>
                  </div>
                </div>
                <div v-show="!isKuCardEditing('kitchen', row)" class="ku-card-meta">
                  <div class="ku-card-meta-grid">
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Point Person</span>
                      <span class="ku-card-meta-value">{{ (row.point_person || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Phone</span>
                      <span class="ku-card-meta-value">{{ (row.phone || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" @click.stop="startKuEdit('kitchen', row)">Edit</button>
                      <button type="button" class="btn-pill-primary" @click.stop="deleteKuRow('kitchen', row.id)">Delete</button>
                    </div>
                  </div>
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
              <button
                type="button"
                class="ku-item-row ku-item-row-toggle"
                @click="toggleKuCardExpanded('utensil', row.id)"
              >
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <span class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <span class="ku-item-arrow" :class="{ 'ku-item-arrow-open': expandedKuCards.has(kuCardKey('utensil', row.id)) }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <div
                v-if="expandedKuCards.has(kuCardKey('utensil', row.id))"
                class="ku-card-detail"
              >
                <div v-show="isKuCardEditing('utensil', row)" class="ku-card-meta ku-card-edit-form">
                  <div v-if="kuEditError" class="ku-edit-error">{{ kuEditError }}</div>
                  <div class="ku-card-edit-fields">
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Name</label>
                      <input v-model="kuEditForm.name" class="ku-card-edit-input" type="text" placeholder="Name" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Point Person</label>
                      <input v-model="kuEditForm.point_person" class="ku-card-edit-input" type="text" placeholder="Point person" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Phone</label>
                      <input v-model="kuEditForm.phone" class="ku-card-edit-input" type="text" placeholder="Phone" />
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="saveKuEdit">{{ kuSaving ? 'Saving…' : 'Save' }}</button>
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="cancelKuEditForm">Cancel</button>
                    </div>
                  </div>
                </div>
                <div v-show="!isKuCardEditing('utensil', row)" class="ku-card-meta">
                  <div class="ku-card-meta-grid">
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Point Person</span>
                      <span class="ku-card-meta-value">{{ (row.point_person || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Phone</span>
                      <span class="ku-card-meta-value">{{ (row.phone || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" @click.stop="startKuEdit('utensil', row)">Edit</button>
                      <button type="button" class="btn-pill-primary" @click.stop="deleteKuRow('utensil', row.id)">Delete</button>
                    </div>
                  </div>
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
              <button
                type="button"
                class="ku-item-row ku-item-row-toggle"
                @click="toggleKuCardExpanded('helper_driver', row.id)"
              >
                <div class="form-section-pill grocery-aisle-dish-pill ku-item-pill">
                  <span class="form-section-pill-input grocery-aisle-dish-text ku-item-name">{{ row.name }}</span>
                </div>
                <span class="ku-item-arrow" :class="{ 'ku-item-arrow-open': expandedKuCards.has(kuCardKey('helper_driver', row.id)) }">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <div
                v-if="expandedKuCards.has(kuCardKey('helper_driver', row.id))"
                class="ku-card-detail"
              >
                <div v-show="isKuCardEditing('helper_driver', row)" class="ku-card-meta ku-card-edit-form">
                  <div v-if="kuEditError" class="ku-edit-error">{{ kuEditError }}</div>
                  <div class="ku-card-edit-fields">
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Name</label>
                      <input v-model="kuEditForm.name" class="ku-card-edit-input" type="text" placeholder="Name" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Phone</label>
                      <input v-model="kuEditForm.phone" class="ku-card-edit-input" type="text" placeholder="Phone" />
                    </div>
                    <div class="ku-card-meta-item">
                      <label class="ku-card-meta-label">Driver</label>
                      <select v-model="driverSelectValue" class="ku-card-driver-select">
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="saveKuEdit">{{ kuSaving ? 'Saving…' : 'Save' }}</button>
                      <button type="button" class="btn-pill-primary" :disabled="kuSaving" @click.stop="cancelKuEditForm">Cancel</button>
                    </div>
                  </div>
                </div>
                <div v-show="!isKuCardEditing('helper_driver', row)" class="ku-card-meta">
                  <div class="ku-card-meta-grid">
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Phone</span>
                      <span class="ku-card-meta-value">{{ (row.phone || '').trim() || '—' }}</span>
                    </div>
                    <div class="ku-card-meta-item">
                      <span class="ku-card-meta-label">Driver</span>
                      <span class="ku-card-meta-value ku-card-meta-driver" :class="{ 'ku-card-driver-yes': row.is_driver === true, 'ku-card-driver-no': row.is_driver === false }">
                        <template v-if="row.is_driver === true">Yes</template>
                        <template v-else-if="row.is_driver === false">No</template>
                        <template v-else>—</template>
                      </span>
                    </div>
                    <div class="ku-card-meta-actions">
                      <button type="button" class="btn-pill-primary" @click.stop="startKuEdit('helper_driver', row)">Edit</button>
                      <button type="button" class="btn-pill-primary" @click.stop="deleteKuRow('helper_driver', row.id)">Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="ku-empty">No helpers or drivers added yet.</div>
        </div>
      </div>

      <!-- Placards Tab -->
      <div v-else-if="activeTab === 'placards'" class="placards-tab">
        <!-- Dietary flags bar (same shape as submission-table-header, background matches placard cards) -->
        <div class="submission-table-header placard-dietary-bar">
          <div class="form-section-pill submission-dish-pill placard-dietary-title">
              <span class="form-section-pill-input submission-dish-text">Dietary Tags</span>
            </div>
          <div
            v-for="{ key, label, icon } in DIETARY_FLAGS"
            :key="key"
            class="sub-header-cell placard-dietary-cell"
          >
            <component :is="icon" :size="18" class="placard-dietary-icon" aria-hidden="true" />
            <span>{{ label }}</span>
          </div>
        </div>

        <!-- Tool bar row: Generate Placards bar (same style as submission-table-header) + buttons outside, right-aligned -->
        <div class="ku-tab-bar-row placard-toolbar-row">
          <div class="submission-table-header placard-generate-bar">
            <span class="placard-generate-title">Generate Placards</span>
          </div>
          <div class="placard-toolbar-actions">
            <button
              type="button"
              class="btn-pill-primary"
              :disabled="isExporting || !selectedPlacardIds.size"
              @click="handleExportPDF"
            >
              Export PDF
            </button>
            <button
              type="button"
              class="btn-pill-primary"
              :disabled="isExporting || !selectedPlacardIds.size"
              @click="handleExportPNG"
            >
              Export PNG
            </button>
            <button
              type="button"
              class="btn-pill-primary placard-edit-flags-btn"
              @click="editPlacardFlagsMode = !editPlacardFlagsMode"
            >
              {{ editPlacardFlagsMode ? 'Done' : 'Edit Tags' }}
            </button>
            <button
              type="button"
              class="btn-pill-primary placard-select-all-btn"
              @click="toggleAllPlacards"
            >
              {{ selectedPlacardIds.size === submissions.length ? 'Deselect All' : 'Select All' }}
            </button>
          </div>
        </div>

        <!-- Export progress indicator -->
        <div v-if="isExporting" class="placard-progress">
          <span class="placard-progress-spinner" />
          <span>{{ exportProgress }}</span>
        </div>

        <!-- Submission list -->
        <div v-if="!submissions.length" class="dashboard-empty">No submissions yet.</div>
        <div v-else class="placard-list">
          <div
            v-for="row in placardRows"
            :key="row.sub.id"
            class="placard-card"
            :class="{ 'placard-card-selected': selectedPlacardIds.has(row.sub.id) }"
            @click="togglePlacardSelection(row.sub.id)"
          >
            <input
              type="checkbox"
              class="placard-checkbox"
              :checked="selectedPlacardIds.has(row.sub.id)"
              @click.stop
              @change="togglePlacardSelection(row.sub.id)"
            />
            <div class="form-section-pill">
              <span class="submission-country-display" :title="countryLabel(row.sub.country_code, row.sub.country_name)">{{ row.sub.country_code === 'OTHER' ? '🏳️' : (row.sub.country_code ? flagEmoji(row.sub.country_code) : '🏳️') }}</span>
            </div>
            <div class="form-section-pill submission-dish-pill">
              <span class="form-section-pill-input submission-dish-text">{{ row.sub.dish_name }}</span>
            </div>
            <div class="grocery-product-dietary placard-row-dietary placard-flags-row">
              <template v-if="editPlacardFlagsMode">
                <span
                  v-for="{ key, label, icon } in DIETARY_FLAGS.filter((f) => row.dietary[f.key])"
                  :key="key"
                  class="placard-flag-wrap"
                >
                  <span class="placard-flag-icon-wrap" :title="label">
                    <component :is="icon" :size="16" class="dietary-icon" aria-hidden="true" />
                  </span>
                  <button
                    type="button"
                    class="placard-flag-remove"
                    :aria-label="`Remove ${label}`"
                    @click.stop="removePlacardFlag(row.sub.id, key)"
                  >
                    <X :size="8" aria-hidden="true" />
                  </button>
                </span>
                <button
                  type="button"
                  class="placard-flag-add"
                  aria-label="Add dietary tag"
                  @click.stop="openAddDropdown(row.sub.id, $event.currentTarget as HTMLElement)"
                >
                  <Plus :size="12" aria-hidden="true" />
                </button>
              </template>
              <template v-else>
                <DietaryIcons v-if="row.hasDietary" :dietary="row.dietary" :size="16" />
              </template>
            </div>
          </div>
        </div>

        <!-- Add-flag dropdown (resource-select style) -->
        <Teleport to="body">
          <div
            v-if="openAddDropdownForSubId !== null"
            ref="placardAddDropdownRef"
            class="resource-select-dropdown placard-add-dropdown"
            role="listbox"
            tabindex="-1"
            :style="addDropdownStyle"
            @click.stop
          >
            <template v-if="placardAddDropdownFlags.length">
              <button
                v-for="flag in placardAddDropdownFlags"
                :key="flag.key"
                type="button"
                role="option"
                class="resource-select-option resource-select-option--single"
                @click.stop="addPlacardFlag(openAddDropdownForSubId!, flag.key)"
              >
                {{ flag.label }}
              </button>
            </template>
            <div v-else class="resource-select-empty">
              All tags added
            </div>
          </div>
        </Teleport>
      </div>

      <!-- Notifications Tab -->
      <div v-else-if="activeTab === 'notifications'" class="notif-tab">
        <div v-if="!notifStore.notifications.length" class="dashboard-empty">No notifications yet.</div>
        <div v-else class="submissions-list">
          <div
            v-for="n in notifStore.notifications"
            :key="n.id"
            class="submission-card notif-card"
            :class="{ 'notif-card-read': n.read }"
          >
            <div class="notif-card-row">
              <div
                class="form-section-pill notif-dot-pill"
                :style="{ background: notifDotColor(n.event_type) }"
                aria-hidden="true"
              />
              <div class="form-section-pill submission-dish-pill">
                <span class="form-section-pill-input submission-dish-text">{{ n.title }}</span>
              </div>
              <span class="notif-card-time tabular-nums qty-num grocery-aisle-header-val">{{ notifRelativeTime(n.created_at) }}</span>
            </div>
            <div v-if="n.message" class="notif-card-detail">{{ n.message }}</div>
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
@import "@/styles/organizer-dashboard.css";
</style>
