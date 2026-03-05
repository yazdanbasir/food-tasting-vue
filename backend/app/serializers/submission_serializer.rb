# Single source of truth for Submission JSON.
class SubmissionSerializer
  def self.as_json(submission)
    new(submission).as_json
  end

  def initialize(submission)
    @s = submission
  end

  def as_json
    {
      id: @s.id,
      team_name: @s.team_name,
      dish_name: @s.dish_name,
      notes: @s.notes,
      country_code: @s.country_code,
      country_name: @s.respond_to?(:country_name) ? @s.country_name : nil,
      members: @s.members.is_a?(Array) ? @s.members : [],
      phone_number: @s.phone_number,
      has_cooking_place: @s.has_cooking_place,
      cooking_location: @s.cooking_location,
      found_all_ingredients: @s.found_all_ingredients,
      other_ingredients: @s.other_ingredients,
      meat_items: @s.meat_items,
      needs_fridge_space: @s.needs_fridge_space,
      needs_utensils: @s.needs_utensils,
      utensils_notes: @s.utensils_notes,
      dish_temperature: @s.dish_temperature,
      dish_description: @s.dish_description,
      allergen: @s.allergen,
      equipment_allocated: @s.equipment_allocated,
      helper_driver_needed: @s.helper_driver_needed,
      fridge_location: @s.fridge_location,
      submitted_at: @s.created_at,
      ingredients: @s.submission_ingredients.map do |si|
        {
          ingredient: IngredientSerializer.as_json(si.ingredient, variant: :summary),
          quantity: si.quantity
        }
      end
    }
  end
end
