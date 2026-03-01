import type { Ingredient } from '@/types/ingredient'

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:1826'

export async function fetchAllIngredients(): Promise<Ingredient[]> {
  const res = await fetch(`${BASE}/api/v1/ingredients/all?v=3`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function searchIngredients(query: string): Promise<Ingredient[]> {
  const res = await fetch(`${BASE}/api/v1/ingredients?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getIngredient(id: number): Promise<Ingredient> {
  const res = await fetch(`${BASE}/api/v1/ingredients/${id}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
