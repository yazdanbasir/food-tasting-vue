# frozen_string_literal: true

class AddPointPersonPhoneIsDriverToKitchenResources < ActiveRecord::Migration[8.0]
  def change
    add_column :kitchen_resources, :point_person, :string unless column_exists?(:kitchen_resources, :point_person)
    add_column :kitchen_resources, :phone, :string unless column_exists?(:kitchen_resources, :phone)
    add_column :kitchen_resources, :is_driver, :boolean unless column_exists?(:kitchen_resources, :is_driver)
  end
end
