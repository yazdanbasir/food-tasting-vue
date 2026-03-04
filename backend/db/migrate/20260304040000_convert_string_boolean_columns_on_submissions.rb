class ConvertStringBooleanColumnsOnSubmissions < ActiveRecord::Migration[8.1]
  def up
    # Add new boolean columns (allow null during migration)
    add_column :submissions, :has_cooking_place_bool, :boolean
    add_column :submissions, :needs_fridge_space_bool, :boolean
    add_column :submissions, :needs_utensils_bool, :boolean
    add_column :submissions, :found_all_ingredients_bool, :boolean

    # Migrate data: use CASE to produce proper boolean values
    execute <<~SQL
      UPDATE submissions SET has_cooking_place_bool = CASE WHEN has_cooking_place = 'yes' THEN 1 ELSE 0 END
    SQL
    execute <<~SQL
      UPDATE submissions SET needs_fridge_space_bool = CASE WHEN needs_fridge_space = 'yes' THEN 1 ELSE 0 END
    SQL
    execute <<~SQL
      UPDATE submissions SET needs_utensils_bool = CASE WHEN needs_utensils = 'yes' THEN 1 ELSE 0 END
    SQL
    execute <<~SQL
      UPDATE submissions SET found_all_ingredients_bool = CASE WHEN found_all_ingredients = 'yes' THEN 1 ELSE 0 END
    SQL

    # Now set defaults and constraints
    change_column_default :submissions, :has_cooking_place_bool, false
    change_column_default :submissions, :needs_fridge_space_bool, false
    change_column_default :submissions, :needs_utensils_bool, false
    change_column_default :submissions, :found_all_ingredients_bool, false
    change_column_null :submissions, :has_cooking_place_bool, false
    change_column_null :submissions, :needs_fridge_space_bool, false
    change_column_null :submissions, :needs_utensils_bool, false
    change_column_null :submissions, :found_all_ingredients_bool, false

    # Remove old string columns
    remove_column :submissions, :has_cooking_place
    remove_column :submissions, :needs_fridge_space
    remove_column :submissions, :needs_utensils
    remove_column :submissions, :found_all_ingredients

    # Rename new columns to original names
    rename_column :submissions, :has_cooking_place_bool, :has_cooking_place
    rename_column :submissions, :needs_fridge_space_bool, :needs_fridge_space
    rename_column :submissions, :needs_utensils_bool, :needs_utensils
    rename_column :submissions, :found_all_ingredients_bool, :found_all_ingredients
  end

  def down
    add_column :submissions, :has_cooking_place_str, :string
    add_column :submissions, :needs_fridge_space_str, :string
    add_column :submissions, :needs_utensils_str, :string
    add_column :submissions, :found_all_ingredients_str, :string

    execute <<~SQL
      UPDATE submissions SET has_cooking_place_str = CASE WHEN has_cooking_place THEN 'yes' ELSE 'no' END
    SQL
    execute <<~SQL
      UPDATE submissions SET needs_fridge_space_str = CASE WHEN needs_fridge_space THEN 'yes' ELSE 'no' END
    SQL
    execute <<~SQL
      UPDATE submissions SET needs_utensils_str = CASE WHEN needs_utensils THEN 'yes' ELSE 'no' END
    SQL
    execute <<~SQL
      UPDATE submissions SET found_all_ingredients_str = CASE WHEN found_all_ingredients THEN 'yes' ELSE 'no' END
    SQL

    remove_column :submissions, :has_cooking_place
    remove_column :submissions, :needs_fridge_space
    remove_column :submissions, :needs_utensils
    remove_column :submissions, :found_all_ingredients

    rename_column :submissions, :has_cooking_place_str, :has_cooking_place
    rename_column :submissions, :needs_fridge_space_str, :needs_fridge_space
    rename_column :submissions, :needs_utensils_str, :needs_utensils
    rename_column :submissions, :found_all_ingredients_str, :found_all_ingredients
  end
end
