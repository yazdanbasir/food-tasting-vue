# frozen_string_literal: true

class AddOtherIngredientsToSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :submissions, :other_ingredients, :text
  end
end
