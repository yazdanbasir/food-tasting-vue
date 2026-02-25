# frozen_string_literal: true

class AddPhoneNumberToSubmissions < ActiveRecord::Migration[8.0]
  def change
    add_column :submissions, :phone_number, :string unless column_exists?(:submissions, :phone_number)
  end
end
