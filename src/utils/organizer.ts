import type { SubmissionResponse } from '@/api/submissions'
import type { Ingredient, IngredientDietary } from '@/types/ingredient'
import { COUNTRIES, flagEmoji } from '@/data/countries'

/** Map API ingredient to frontend Ingredient for IngredientRow */
export function toIngredient(raw: SubmissionResponse['ingredients'][0]['ingredient']): Ingredient {
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

/** Format utensils_notes for display: if JSON array of {utensil, size, quantity}, show readable list; else show raw string */
export function formatUtensilsNotes(notes: string | null | undefined): string {
  return formatUtensilsNotesLines(notes).join('; ')
}

/** Same as formatUtensilsNotes but returns one line per item (for one-per-line display) */
export function formatUtensilsNotesLines(notes: string | null | undefined): string[] {
  if (!notes || !notes.trim()) return []
  try {
    const parsed = JSON.parse(notes) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((row: { utensil?: string; size?: string; quantity?: string }) => {
          const u = String(row?.utensil ?? '').trim()
          if (!u) return ''
          const s = String(row?.size ?? '').trim()
          const q = String(row?.quantity ?? '').trim()
          const parts = [u]
          if (s || q) parts.push([s, q].filter(Boolean).join(', '))
          return parts.join(' (') + (parts.length > 1 ? ')' : '')
        })
        .filter(Boolean)
    }
  } catch {
    /* fall through to raw */
  }
  return [notes]
}

/** Equipment lines as { name, details } for two-line display (name; details in smaller print) */
export function formatUtensilsNotesStructured(notes: string | null | undefined): { name: string; details: string }[] {
  if (!notes || !notes.trim()) return []
  try {
    const parsed = JSON.parse(notes) as unknown
    if (Array.isArray(parsed)) {
      return parsed
        .map((row: { utensil?: string; size?: string; quantity?: string }) => {
          const u = String(row?.utensil ?? '').trim()
          if (!u) return null
          const s = String(row?.size ?? '').trim()
          const q = String(row?.quantity ?? '').trim()
          const details = [s, q].filter(Boolean).join(', ')
          return { name: u, details }
        })
        .filter((x): x is { name: string; details: string } => x != null)
    }
  } catch {
    /* fall through to raw */
  }
  return [{ name: notes, details: '' }]
}

/** Parsed utensil entry from utensils_notes JSON for aggregation */
export interface UtensilParsed {
  utensil: string
  size: string
  quantity: number
}

/** Parse utensils_notes JSON into structured entries (for aggregation) */
export function parseUtensilsNotes(notes: string | null | undefined): UtensilParsed[] {
  if (!notes || !notes.trim()) return []
  try {
    const parsed = JSON.parse(notes) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row: { utensil?: string; size?: string; quantity?: string }) => {
        const u = String(row?.utensil ?? '').trim()
        if (!u) return null
        const s = String(row?.size ?? '').trim()
        const q = Math.max(0, parseInt(String(row?.quantity ?? '1'), 10) || 1)
        return { utensil: u, size: s, quantity: q }
      })
      .filter((x): x is UtensilParsed => x != null)
  } catch {
    return []
  }
}

/** Parse other_ingredients JSON into rows for "Other Stores" tab in submission detail */
export function parseOtherIngredients(sub: SubmissionResponse): Array<{ item: string; size: string; quantity: string; additionalDetails: string }> {
  const raw = (sub.other_ingredients ?? '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((row: Record<string, unknown>) => ({
        item: String(row?.item ?? '').trim(),
        size: String(row?.size ?? '').trim(),
        quantity: String(row?.quantity ?? '').trim(),
        additionalDetails: String(row?.additionalDetails ?? row?.additional_details ?? '').trim(),
      }))
    }
  } catch {
    /* fall through */
  }
  return []
}

/** Quantity is stored as "number unit" (e.g. "2 lb"). Return the numeric part for display. */
export function parseOtherIngredientQuantity(qtyStr: string): number {
  const s = String(qtyStr ?? '').trim()
  const m = s.match(/^\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : 0
}

/** Quantity is stored as "number unit". Return the unit part (e.g. "lb") or "". */
export function getOtherIngredientUnit(qtyStr: string): string {
  const s = String(qtyStr ?? '').trim()
  const m = s.match(/^\d+(\.\d+)?\s*(.*)$/)
  return (m?.[2] ?? '').trim()
}

/** Phone numbers in same order as members (for meta box aligned with Members column) */
export function submissionPhoneNumbers(sub: SubmissionResponse): string[] {
  const raw = (sub.phone_number ?? '').trim()
  const phones = raw ? raw.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean) : []
  const members = sub.members || []
  if (members.length === 0 && phones.length === 0) return []
  const max = Math.max(members.length, phones.length, 1)
  return Array.from({ length: max }, (_, i) => phones[i] ?? '—')
}

export function formatAisleTitle(aisle: string): string {
  if (!aisle || aisle === 'Other' || aisle === 'Unknown') return 'Aisle Other'
  return `Aisle ${aisle}`
}

export function countryLabel(code: string | null, countryName?: string | null): string {
  if (!code) return 'country'
  if (code === 'OTHER' && countryName) return countryName
  const c = COUNTRIES.find((x) => x.code === code)
  return c ? `${flagEmoji(c.code)} ${c.name}` : 'country'
}

export const EMPTY_DIETARY: IngredientDietary = {
  is_alcohol: false,
  gluten: false,
  dairy: false,
  egg: false,
  peanut: false,
  pork: false,
  shellfish: false,
  kosher: false,
  vegan: false,
  vegetarian: false,
  lactose_free: false,
  wheat_free: false,
}

/** Map an "other stores" entry to a minimal Ingredient for IngredientRow (placeholder thumb, name, size, qty) */
export function otherEntryToIngredient(
  entry: { item: string; size: string; quantity: string; additionalDetails: string },
  index: number
): Ingredient {
  const sizePart = [entry.size, entry.additionalDetails].filter(Boolean).join(' · ') || null
  return {
    id: -index - 1,
    product_id: `other-${index}`,
    name: entry.item || '—',
    size: sizePart,
    aisle: null,
    category: null,
    image_url: null,
    price_cents: 0,
    price: 0,
    dietary: EMPTY_DIETARY,
  }
}
