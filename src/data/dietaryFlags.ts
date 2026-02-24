import type { Component } from 'vue'
import {
  Wine,
  Wheat,
  Milk,
  Egg,
  Nut,
  Star,
  Leaf,
  Carrot,
  MilkOff,
  WheatOff,
} from 'lucide-vue-next'

export type DietaryFlagKey = keyof import('@/types/ingredient').IngredientDietary

/** Display order, label, and icon for each dietary flag. */
export const DIETARY_FLAGS: { key: DietaryFlagKey; label: string; icon: Component }[] = [
  { key: 'is_alcohol', label: 'Alcohol', icon: Wine },
  { key: 'gluten', label: 'Gluten', icon: Wheat },
  { key: 'dairy', label: 'Dairy', icon: Milk },
  { key: 'egg', label: 'Egg', icon: Egg },
  { key: 'peanut', label: 'Peanut', icon: Nut },
  { key: 'kosher', label: 'Kosher', icon: Star },
  { key: 'vegan', label: 'Vegan', icon: Leaf },
  { key: 'vegetarian', label: 'Vegetarian', icon: Carrot },
  { key: 'lactose_free', label: 'Lactose free', icon: MilkOff },
  { key: 'wheat_free', label: 'Wheat free', icon: WheatOff },
]
