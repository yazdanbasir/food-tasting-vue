const BASE = import.meta.env.VITE_API_BASE_URL

export interface SubmissionPayload {
  team_name: string
  dish_name: string
  notes?: string
  ingredients: { ingredient_id: number; quantity: number }[]
}

export interface SubmissionIngredientResponse {
  ingredient: {
    id: number
    product_id: string
    name: string
    size: string | null
    aisle: string | null
    price_cents: number
    image_url: string | null
  }
  quantity: number
}

export interface SubmissionResponse {
  id: number
  access_code: string
  team_name: string
  dish_name: string
  notes: string | null
  submitted_at: string
  ingredients: SubmissionIngredientResponse[]
}

export async function createSubmission(
  payload: SubmissionPayload,
): Promise<{ access_code: string; submission: SubmissionResponse }> {
  const res = await fetch(`${BASE}/api/v1/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Submit failed: ${res.status}`)
  }
  return res.json()
}

export async function getAllSubmissions(token: string): Promise<SubmissionResponse[]> {
  const res = await fetch(`${BASE}/api/v1/submissions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Failed to load submissions: ${res.status}`)
  return res.json()
}
