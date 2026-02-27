class AddFridgeLocationToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :fridge_location, :string
  end
end

