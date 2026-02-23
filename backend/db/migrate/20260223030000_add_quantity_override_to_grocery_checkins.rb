class AddQuantityOverrideToGroceryCheckins < ActiveRecord::Migration[8.1]
  def change
    add_column :grocery_checkins, :quantity_override, :integer
  end
end
