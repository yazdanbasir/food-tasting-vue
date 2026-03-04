import type { SubmissionResponse } from '@/api/submissions'
import type { IngredientDietary } from '@/types/ingredient'

const DIETARY_KEYS = [
  'is_alcohol', 'gluten', 'dairy', 'egg', 'peanut',
  'pork', 'shellfish',
  'kosher', 'vegan', 'vegetarian', 'lactose_free', 'wheat_free',
] as const

/**
 * Aggregate dietary flags across all ingredients of a submission.
 * Returns an IngredientDietary where each flag is true if ANY ingredient has it.
 */
export function aggregateDietary(sub: SubmissionResponse): IngredientDietary {
  const out = {} as IngredientDietary
  for (const k of DIETARY_KEYS) {
    out[k] = sub.ingredients.some((item) => item.ingredient.dietary?.[k])
  }
  return out
}

/**
 * Human-readable relative time string (e.g. "just now", "5m ago", "2h ago").
 */
export function notifRelativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

/**
 * Dot colour for a notification event type.
 */
export function notifDotColor(eventType: string): string {
  const deletion = ['submission_deleted', 'ingredient_removed']
  const edited = [
    'ingredient_updated',
    'submission_updated_organizer',
    'submission_updated_user',
    'grocery_qty_changed',
    'grocery_item_checked',
    'grocery_item_unchecked',
    'master_list_checked',
    'master_list_unchecked',
  ]
  if (deletion.includes(eventType)) return '#dc2626' /* red */
  if (edited.includes(eventType)) return '#2563eb' /* blue */
  return '#16a34a' /* green: new/add/default */
}
