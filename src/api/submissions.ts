import { organizerHeaders, clearStaleOrganizerToken } from '@/api/organizer'

const BASE = import.meta.env.VITE_API_BASE_URL

export interface SubmissionPayload {
  team_name: string
  dish_name: string
  notes?: string
  country_code?: string
  members?: string[]
  phone_number?: string
  has_cooking_place?: string
  cooking_location?: string
  ingredients: { ingredient_id: number; quantity: number }[]
}

import type { IngredientDietary } from '@/types/ingredient'

export interface SubmissionIngredientResponse {
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
  quantity: number
}

export interface SubmissionResponse {
  id: number
  team_name: string
  dish_name: string
  notes: string | null
  country_code: string | null
  members: string[]
  phone_number?: string | null
  has_cooking_place?: string | null
  cooking_location?: string | null
  submitted_at: string
  ingredients: SubmissionIngredientResponse[]
}

export async function createSubmission(
  payload: SubmissionPayload,
): Promise<{ submission: SubmissionResponse }> {
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

export async function getAllSubmissions(): Promise<SubmissionResponse[]> {
  const res = await fetch(`${BASE}/api/v1/submissions`)
  if (!res.ok) throw new Error(`Failed to load submissions: ${res.status}`)
  return res.json()
}

export async function updateSubmission(
  id: number,
  payload: SubmissionPayload,
): Promise<SubmissionResponse> {
  const headers = organizerHeaders()
  console.log('[Organizer Auth] updateSubmission:', id)
  const res = await fetch(`${BASE}/api/v1/submissions/by_id/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) {
    console.error('[Organizer Auth] updateSubmission 401 Unauthorized - backend rejected token or no token sent. Body:', body)
    clearStaleOrganizerToken()
    throw new Error('Session expired. Please log in again from the Organizer tab.')
  }
  if (!res.ok) {
    throw new Error((body as { error?: string }).error || `Update failed: ${res.status}`)
  }
  return body as SubmissionResponse
}
