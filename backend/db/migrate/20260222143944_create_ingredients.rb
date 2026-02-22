class CreateIngredients < ActiveRecord::Migration[8.1]
  def change
    create_table :ingredients do |t|
      # Giant's internal product ID — used as the stable import key
      t.string  :product_id,   null: false, index: { unique: true }

      # Core display fields
      t.string  :name,         null: false
      t.string  :size
      t.string  :aisle
      t.string  :image_url
      t.string  :category

      # Price stored in cents to avoid floating-point errors
      t.integer :price_cents,  null: false, default: 0

      # Dietary flags
      t.boolean :is_alcohol,   null: false, default: false
      t.boolean :gluten,       null: false, default: false
      t.boolean :dairy,        null: false, default: false
      t.boolean :egg,          null: false, default: false
      t.boolean :peanut,       null: false, default: false
      t.boolean :kosher,       null: false, default: false
      t.boolean :vegan,        null: false, default: false
      t.boolean :vegetarian,   null: false, default: false
      t.boolean :lactose_free, null: false, default: false
      t.boolean :wheat_free,   null: false, default: false

      # Tracks when this record was last synced from Giant
      t.datetime :scraped_at

      t.timestamps
    end

    # Indexes for search and filtering
    add_index :ingredients, :name
    add_index :ingredients, :category
  end
end
