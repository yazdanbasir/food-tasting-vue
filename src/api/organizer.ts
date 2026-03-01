import type { SubmissionResponse } from '@/api/submissions'
import type { IngredientDietary } from '@/types/ingredient'

const BASE = import.meta.env.VITE_API_BASE_URL

let onUnauthorized: (() => void | Promise<void>) | null = null
let reauthInFlight: Promise<boolean> | null = null

/** Register a callback invoked on any 401 response. Called once from useLockOverlay to avoid circular imports. */
export function setOnUnauthorized(cb: () => void | Promise<void>): void {
  onUnauthorized = cb
}

function getStorage(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null
}

export function organizerHeaders(): HeadersInit {
  const token = getStorage()?.getItem('organizer_token') ?? null
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function silentOrganizerReauth(): Promise<boolean> {
  if (reauthInFlight) return reauthInFlight
  reauthInFlight = (async () => {
    try {
      const username = (import.meta.env.VITE_ORGANIZER_API_USERNAME as string | undefined) ?? 'organizer'
      const password = (import.meta.env.VITE_ORGANIZER_API_PASSWORD as string | undefined) ?? 'disney1994'
      const result = await organizerLogin(username, password)
      const storage = getStorage()
      storage?.setItem('organizer_token', result.token)
      storage?.setItem('organizer_username', result.username)
      return true
    } catch {
      return false
    } finally {
      reauthInFlight = null
    }
  })()
  return reauthInFlight
}

function withFreshAuthHeaders(initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = getStorage()?.getItem('organizer_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  else headers.delete('Authorization')
  return headers
}

export async function organizerFetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const first = await fetch(url, {
    ...init,
    headers: withFreshAuthHeaders(init.headers),
  })
  if (first.status !== 401) return first

  await silentOrganizerReauth()

  const second = await fetch(url, {
    ...init,
    headers: withFreshAuthHeaders(init.headers),
  })

  if (second.status === 401) {
    await onUnauthorized?.()
  }
  return second
}

/** @deprecated compatibility export; prefer organizerFetchWithRetry */
export const clearStaleOrganizerToken = (): void => {
  void onUnauthorized?.()
}

/** Check if the current client has an organizer token (e.g. before update). */
export function hasOrganizerToken(): boolean {
  return !!getStorage()?.getItem('organizer_token')
}

export async function organizerLogin(
  username: string,
  password: string,
): Promise<{ token: string; username: string }> {
  console.log('[Organizer Auth]', 'organizerLogin: POST', `${BASE}/api/v1/organizer_session`, { username })
  const res = await fetch(`${BASE}/api/v1/organizer_session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[Organizer Auth]', 'organizerLogin FAILED:', res.status, body)
    throw new Error((body as { error?: string }).error || 'Login failed')
  }
  const result = body as { token: string; username: string }
  console.log('[Organizer Auth]', 'organizerLogin SUCCESS:', { username: result.username, tokenPrefix: result.token?.slice(0, 8) + '...' })
  return result
}

export interface GroceryItem {
  ingredient: {
    id: number
    product_id: string
    name: string
    size: string | null
    aisle: string | null
    price_cents: number
    image_url: string | null
    dietary: IngredientDietary
  }
  total_quantity: number
  teams: string[]
  checked: boolean
  checked_by: string | null
  checked_at: string | null
}

export interface GroceryListResponse {
  aisles: Record<string, GroceryItem[]>
  total_cents: number
}

export async function getGroceryList(): Promise<GroceryListResponse> {
  const res = await fetch(`${BASE}/api/v1/grocery_list`)
  if (!res.ok) throw new Error(`Failed to load grocery list: ${res.status}`)
  return res.json()
}

export async function checkGroceryItem(ingredientId: number, checked: boolean): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/grocery_list/${ingredientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checked }),
  })
  if (!res.ok) throw new Error(`Failed to update item: ${res.status}`)
}

/** Notify backend when checking Other Stores / Utensils master list items (creates notification like Giant tab). */
export async function masterListCheckNotify(
  listType: 'other_stores' | 'utensils_equipment',
  label: string,
  checked: boolean,
): Promise<void> {
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/grocery_list/master_list_check`, {
    method: 'POST',
    headers: organizerHeaders(),
    body: JSON.stringify({ list_type: listType, label, checked }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Failed to update notification')
  }
}

export async function updateGroceryQuantity(ingredientId: number, quantity: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/grocery_list/${ingredientId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  })
  if (!res.ok) throw new Error(`Failed to update quantity: ${res.status}`)
}

export async function addGroceryItem(ingredientId: number, quantity: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/grocery_list/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredient_id: ingredientId, quantity }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Failed to add item: ${res.status}`)
  }
}

export async function addSubmissionIngredient(
  submissionId: number,
  ingredientId: number,
  quantity: number,
): Promise<void> {
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/submissions/by_id/${submissionId}/ingredients`, {
    method: 'POST',
    headers: organizerHeaders(),
    body: JSON.stringify({ ingredient_id: ingredientId, quantity }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Failed to add ingredient: ${res.status}`)
  }
}

export async function updateSubmissionIngredientQuantity(
  submissionId: number,
  ingredientId: number,
  quantity: number,
): Promise<void> {
  const res = await organizerFetchWithRetry(
    `${BASE}/api/v1/submissions/by_id/${submissionId}/ingredients/${ingredientId}`,
    {
      method: 'PATCH',
      headers: organizerHeaders(),
      body: JSON.stringify({ quantity }),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { error?: string }).error || `Failed to update quantity: ${res.status}`,
    )
  }
}

export interface KitchenAllocationPayload {
  cooking_location?: string | null
  equipment_allocated?: string | null
  helper_driver_needed?: string | null
  fridge_location?: string | null
}

export async function updateKitchenAllocation(
  id: number,
  fields: KitchenAllocationPayload,
): Promise<SubmissionResponse> {
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/submissions/by_id/${id}/kitchen_allocation`, {
    method: 'PATCH',
    headers: organizerHeaders(),
    body: JSON.stringify(fields),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((body as { error?: string }).error || 'Could not save assignment right now. Please try again.')
  return body as SubmissionResponse
}

export async function deleteSubmission(submissionId: number): Promise<void> {
  const headers = organizerHeaders()
  console.log('[Organizer Auth]', 'deleteSubmission:', submissionId)
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/submissions/by_id/${submissionId}`, {
    method: 'DELETE',
    headers,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || 'Could not delete this submission right now. Please try again.')
  }
  console.log('[Organizer Auth]', 'deleteSubmission SUCCESS:', submissionId)
}

// ─── Kitchens & Utensils resources ─────────────────────────────────────────

export type KitchenResourceKind = 'kitchen' | 'utensil' | 'helper_driver' | 'fridge'

export interface KitchenResourceItem {
  id: number
  kind: KitchenResourceKind
  name: string
  position: number | null
  /** Point person / contact name (optional, for Fridge/Kitchen/Utensils) */
  point_person?: string | null
  /** Contact phone (optional) */
  phone?: string | null
  /** For Helpers/Drivers: whether this person is a driver (optional) */
  is_driver?: boolean | null
}

export async function getKitchenResources(): Promise<KitchenResourceItem[]> {
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/kitchen_resources`, {
    headers: organizerHeaders(),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Failed to load kitchen resources: ${res.status}`)
  }
  return body as KitchenResourceItem[]
}

export type CreateKitchenResourcePayload = {
  kind: KitchenResourceKind
  name: string
  point_person?: string | null
  phone?: string | null
  is_driver?: boolean | null
}

export async function createKitchenResource(
  payload: CreateKitchenResourcePayload,
): Promise<KitchenResourceItem> {
  const { kind, name, point_person, phone, is_driver } = payload
  const requestBody: Record<string, unknown> = { kind, name }
  if (point_person != null) requestBody.point_person = point_person
  if (phone != null) requestBody.phone = phone
  if (is_driver != null && kind === 'helper_driver') requestBody.is_driver = is_driver
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/kitchen_resources`, {
    method: 'POST',
    headers: organizerHeaders(),
    body: JSON.stringify(requestBody),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || 'Could not add this resource right now. Please try again.')
  }
  return body as KitchenResourceItem
}

export async function updateKitchenResource(
  id: number,
  attrs: Partial<Pick<KitchenResourceItem, 'name' | 'position' | 'point_person' | 'phone' | 'is_driver'>>,
): Promise<KitchenResourceItem> {
  console.log('[KU TRACE][API] updateKitchenResource request', {
    id,
    attrs,
    hasAuthToken: hasOrganizerToken(),
  })
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/kitchen_resources/${id}`, {
    method: 'PATCH',
    headers: organizerHeaders(),
    body: JSON.stringify(attrs),
  })
  const body = await res.json().catch(() => ({}))
  console.log('[KU TRACE][API] updateKitchenResource response', {
    id,
    status: res.status,
    ok: res.ok,
    body,
  })
  if (res.ok) {
    const responseObj = body as Partial<KitchenResourceItem>
    const missingEchoedFields: string[] = []
    if ('phone' in attrs && responseObj.phone === undefined) missingEchoedFields.push('phone')
    if ('point_person' in attrs && responseObj.point_person === undefined) missingEchoedFields.push('point_person')
    if ('is_driver' in attrs && responseObj.is_driver === undefined) missingEchoedFields.push('is_driver')
    if (missingEchoedFields.length) {
      console.warn('[KU TRACE][API] response missing edited fields', {
        id,
        missingEchoedFields,
        attrs,
        body,
      })
    }
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || 'Could not save this resource right now. Please try again.')
  }
  return body as KitchenResourceItem
}

export async function deleteKitchenResource(id: number): Promise<void> {
  const res = await organizerFetchWithRetry(`${BASE}/api/v1/kitchen_resources/${id}`, {
    method: 'DELETE',
    headers: organizerHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Could not delete this resource right now. Please try again.')
  }
}
