class CreateAppSettings < ActiveRecord::Migration[8.1]
  def change
    create_table :app_settings do |t|
      t.boolean :submissions_locked, null: false, default: false

      t.timestamps
    end
  end
end
