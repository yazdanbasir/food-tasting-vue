class CreateKitchenResources < ActiveRecord::Migration[8.1]
  def change
    create_table :kitchen_resources do |t|
      t.string  :kind, null: false
      t.string  :name, null: false
      t.integer :position

      t.timestamps
    end

    add_index :kitchen_resources, :kind
  end
end

