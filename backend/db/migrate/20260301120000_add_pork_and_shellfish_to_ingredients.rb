class AddPorkAndShellfishToIngredients < ActiveRecord::Migration[8.0]
  def change
    add_column :ingredients, :pork, :boolean, default: false
    add_column :ingredients, :shellfish, :boolean, default: false
  end
end
