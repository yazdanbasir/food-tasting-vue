class AddMeatItemsToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :meat_items, :text
  end
end
