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
  found_all_ingredients?: string
  needs_fridge_space?: string
  needs_utensils?: string
  utensils_notes?: string
  other_ingredients?: string
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
  found_all_ingredients?: string | null
  needs_fridge_space?: string | null
  needs_utensils?: string | null
  utensils_notes?: string | null
  other_ingredients?: string | null
  equipment_allocated?: string | null
  helper_driver_needed?: string | null
  fridge_location?: string | null
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

export async function lookupSubmissionByPhone(
  phone: string,
): Promise<{ submission: SubmissionResponse }> {
  const res = await fetch(`${BASE}/api/v1/submissions/lookup?phone=${encodeURIComponent(phone)}`)
  if (res.status === 404 || res.status === 422) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || 'Submission not found')
  }
  if (!res.ok) throw new Error(`Lookup failed: ${res.status}`)
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
