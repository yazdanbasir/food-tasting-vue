class AddFoundAllIngredientsAndNeedsUtensilsToSubmissions < ActiveRecord::Migration[8.0]
  def change
    add_column :submissions, :found_all_ingredients, :string
    add_column :submissions, :needs_utensils, :string
  end
end
