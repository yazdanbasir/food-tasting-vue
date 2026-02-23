const BASE = import.meta.env.VITE_API_BASE_URL

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

export async function organizerLogin(
  username: string,
  password: string,
): Promise<{ token: string; username: string }> {
  const res = await fetch(`${BASE}/api/v1/organizer_session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Login failed')
  }
  return res.json()
}

export async function organizerLogout(token: string): Promise<void> {
  await fetch(`${BASE}/api/v1/organizer_session`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getGroceryList(token: string): Promise<GroceryListResponse> {
  const res = await fetch(`${BASE}/api/v1/grocery_list`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to load grocery list: ${res.status}`)
  return res.json()
}

export async function checkGroceryItem(
  token: string,
  ingredientId: number,
  checked: boolean,
): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/grocery_list/${ingredientId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ checked }),
  })
  if (!res.ok) throw new Error(`Failed to update item: ${res.status}`)
}

export async function updateGroceryQuantity(
  token: string,
  ingredientId: number,
  quantity: number,
): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/grocery_list/${ingredientId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ quantity }),
  })
  if (!res.ok) throw new Error(`Failed to update quantity: ${res.status}`)
}
