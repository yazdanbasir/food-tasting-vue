class CreateNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :notifications do |t|
      t.string :event_type, null: false
      t.string :title, null: false
      t.string :message
      t.boolean :read, default: false, null: false
      t.timestamps
    end
    add_index :notifications, :read
    add_index :notifications, :created_at
  end
end
