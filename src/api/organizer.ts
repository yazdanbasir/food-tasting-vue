const BASE = import.meta.env.VITE_API_BASE_URL

function organizerHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('organizer_token') : null
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  return headers
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

export async function deleteSubmission(submissionId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/submissions/by_id/${submissionId}`, {
    method: 'DELETE',
    headers: organizerHeaders(),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Failed to delete submission: ${res.status}`)
  }
}
