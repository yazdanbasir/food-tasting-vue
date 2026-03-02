# frozen_string_literal: true

class AddDishTemperatureToSubmissions < ActiveRecord::Migration[7.0]
  def change
    add_column :submissions, :dish_temperature, :string
  end
end
