# frozen_string_literal: true

class AddCountryNameToSubmissions < ActiveRecord::Migration[7.0]
  def change
    add_column :submissions, :country_name, :string unless column_exists?(:submissions, :country_name)
  end
end
