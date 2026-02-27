class AddKitchenFieldsToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :utensils_notes,        :text
    add_column :submissions, :equipment_allocated,   :string
    add_column :submissions, :helper_driver_needed,  :string
  end
end
