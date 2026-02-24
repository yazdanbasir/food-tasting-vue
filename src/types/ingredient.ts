export interface IngredientDietary {
  is_alcohol: boolean
  gluten: boolean
  dairy: boolean
  egg: boolean
  peanut: boolean
  kosher: boolean
  vegan: boolean
  vegetarian: boolean
  lactose_free: boolean
  wheat_free: boolean
}

export interface Ingredient {
  id: number
  product_id: string
  name: string
  size: string | null
  aisle: string | null
  category: string | null
  image_url: string | null
  price_cents: number
  price: number
  dietary: IngredientDietary
}
