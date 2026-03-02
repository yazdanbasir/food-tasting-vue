# frozen_string_literal: true

class AddDishDescriptionToSubmissions < ActiveRecord::Migration[7.0]
  def change
    add_column :submissions, :dish_description, :string
  end
end
