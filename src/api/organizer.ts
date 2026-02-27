import type { SubmissionResponse } from '@/api/submissions'

const BASE = import.meta.env.VITE_API_BASE_URL

let onUnauthorized: (() => void) | null = null

/** Register a callback invoked on any 401 response. Called once from useLockOverlay to avoid circular imports. */
export function setOnUnauthorized(cb: () => void): void {
  onUnauthorized = cb
}

export function organizerHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('organizer_token') : null
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

function handleUnauthorized(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('organizer_token')
    localStorage.removeItem('organizer_username')
  }
  onUnauthorized?.()
}

/** @deprecated use handleUnauthorized internally; exported only for submissions.ts */
export const clearStaleOrganizerToken = handleUnauthorized

/** Check if the current client has an organizer token (e.g. before update). */
export function hasOrganizerToken(): boolean {
  if (typeof localStorage === 'undefined') return false
  return !!localStorage.getItem('organizer_token')
}

export async function organizerLogin(
  username: string,
  password: string,
): Promise<{ token: string; username: string }> {
  console.log(LOG_PREFIX, 'organizerLogin: POST', `${BASE}/api/v1/organizer_session`, { username })
  const res = await fetch(`${BASE}/api/v1/organizer_session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(LOG_PREFIX, 'organizerLogin FAILED:', res.status, body)
    throw new Error((body as { error?: string }).error || 'Login failed')
  }
  const result = body as { token: string; username: string }
  console.log(LOG_PREFIX, 'organizerLogin SUCCESS:', { username: result.username, tokenPrefix: result.token?.slice(0, 8) + '...' })
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
  const res = await fetch(`${BASE}/api/v1/submissions/by_id/${submissionId}/ingredients`, {
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
  const res = await fetch(
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
  cooking_location?: string
  equipment_allocated?: string
  helper_driver_needed?: string
}

export async function updateKitchenAllocation(
  id: number,
  fields: KitchenAllocationPayload,
): Promise<SubmissionResponse> {
  const res = await fetch(`${BASE}/api/v1/submissions/by_id/${id}/kitchen_allocation`, {
    method: 'PATCH',
    headers: organizerHeaders(),
    body: JSON.stringify(fields),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) throw new Error((body as { error?: string }).error || `Kitchen update failed: ${res.status}`)
  return body as SubmissionResponse
}

export async function deleteSubmission(submissionId: number): Promise<void> {
  const headers = organizerHeaders()
  console.log(LOG_PREFIX, 'deleteSubmission:', submissionId)
  const res = await fetch(`${BASE}/api/v1/submissions/by_id/${submissionId}`, {
    method: 'DELETE',
    headers,
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    console.error(LOG_PREFIX, 'deleteSubmission 401 Unauthorized - backend rejected token or no token sent. Body:', body)
    handleUnauthorized()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Failed to delete submission: ${res.status}`)
  }
  console.log(LOG_PREFIX, 'deleteSubmission SUCCESS:', submissionId)
}

// ─── Kitchens & Utensils resources ─────────────────────────────────────────

export type KitchenResourceKind = 'kitchen' | 'utensil' | 'helper_driver'

export interface KitchenResourceItem {
  id: number
  kind: KitchenResourceKind
  name: string
  position: number | null
}

export async function getKitchenResources(): Promise<KitchenResourceItem[]> {
  const res = await fetch(`${BASE}/api/v1/kitchen_resources`, {
    headers: organizerHeaders(),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Failed to load kitchen resources: ${res.status}`)
  }
  return body as KitchenResourceItem[]
}

export async function createKitchenResource(
  kind: KitchenResourceKind,
  name: string,
): Promise<KitchenResourceItem> {
  const res = await fetch(`${BASE}/api/v1/kitchen_resources`, {
    method: 'POST',
    headers: organizerHeaders(),
    body: JSON.stringify({ kind, name }),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Failed to create kitchen resource: ${res.status}`)
  }
  return body as KitchenResourceItem
}

export async function updateKitchenResource(
  id: number,
  attrs: Partial<Pick<KitchenResourceItem, 'name' | 'position'>>,
): Promise<KitchenResourceItem> {
  const res = await fetch(`${BASE}/api/v1/kitchen_resources/${id}`, {
    method: 'PATCH',
    headers: organizerHeaders(),
    body: JSON.stringify(attrs),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    handleUnauthorized()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Failed to update kitchen resource: ${res.status}`)
  }
  return body as KitchenResourceItem
}

export async function deleteKitchenResource(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/kitchen_resources/${id}`, {
    method: 'DELETE',
    headers: organizerHeaders(),
  })
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    console.error(LOG_PREFIX, 'deleteKitchenResource 401 Unauthorized - backend rejected token or no token sent. Body:', body)
    handleUnauthorized()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Failed to delete kitchen resource: ${res.status}`)
  }
}
