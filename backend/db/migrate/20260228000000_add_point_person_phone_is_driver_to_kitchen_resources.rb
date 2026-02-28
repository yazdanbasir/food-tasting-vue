# frozen_string_literal: true
# Assignments (Fridges, Kitchens, Utensils, Helpers) need these columns for point_person, phone, is_driver to persist.
# If edit data doesn't persist after refresh, run: cd backend && bundle exec rails db:migrate

class AddPointPersonPhoneIsDriverToKitchenResources < ActiveRecord::Migration[8.0]
  def change
    add_column :kitchen_resources, :point_person, :string unless column_exists?(:kitchen_resources, :point_person)
    add_column :kitchen_resources, :phone, :string unless column_exists?(:kitchen_resources, :phone)
    add_column :kitchen_resources, :is_driver, :boolean unless column_exists?(:kitchen_resources, :is_driver)
  end
end
