class CreateGroceryCheckins < ActiveRecord::Migration[8.1]
  def change
    create_table :grocery_checkins do |t|
      t.references :ingredient, null: false, foreign_key: true, index: { unique: true }
      t.boolean :checked, null: false, default: false
      t.string :checked_by
      t.datetime :checked_at

      t.timestamps
    end
  end
end
