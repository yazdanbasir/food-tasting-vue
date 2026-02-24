import type { Ingredient } from './ingredient'

export interface SubmissionIngredient {
  ingredient: Ingredient
  quantity: number
}

export interface Submission {
  id: string
  teamName: string
  dishName: string
  members: string[]
  ingredients: SubmissionIngredient[]
  notes: string
  submittedAt: Date
}

export interface MasterListItem {
  ingredient: Ingredient
  totalQuantity: number
  teams: string[]
}
