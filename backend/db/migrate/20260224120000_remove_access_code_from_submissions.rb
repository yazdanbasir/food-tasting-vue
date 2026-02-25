# frozen_string_literal: true

class RemoveAccessCodeFromSubmissions < ActiveRecord::Migration[8.0]
  def change
    remove_index :submissions, :access_code, if_exists: true
    remove_column :submissions, :access_code, :string
  end
end
