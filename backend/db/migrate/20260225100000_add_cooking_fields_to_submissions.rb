# frozen_string_literal: true

class AddCookingFieldsToSubmissions < ActiveRecord::Migration[8.0]
  def change
    add_column :submissions, :has_cooking_place, :string unless column_exists?(:submissions, :has_cooking_place)
    add_column :submissions, :cooking_location, :string unless column_exists?(:submissions, :cooking_location)
  end
end
