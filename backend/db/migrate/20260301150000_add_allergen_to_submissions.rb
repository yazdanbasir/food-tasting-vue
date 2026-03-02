# frozen_string_literal: true

class AddAllergenToSubmissions < ActiveRecord::Migration[7.0]
  def change
    add_column :submissions, :allergen, :string
  end
end
