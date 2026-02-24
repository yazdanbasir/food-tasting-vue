class CreateSubmissions < ActiveRecord::Migration[8.1]
  def change
    create_table :submissions do |t|
      t.string :dish_name, null: false
      t.string :team_name, null: false
      t.text :notes
      t.string :access_code, null: false

      t.timestamps
    end
    add_index :submissions, :access_code, unique: true
  end
end
