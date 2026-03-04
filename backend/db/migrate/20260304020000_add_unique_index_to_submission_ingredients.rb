class AddUniqueIndexToSubmissionIngredients < ActiveRecord::Migration[8.1]
  def change
    add_index :submission_ingredients, [:submission_id, :ingredient_id],
              unique: true,
              name: "idx_submission_ingredients_unique"
  end
end
