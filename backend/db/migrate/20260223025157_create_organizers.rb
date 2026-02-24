class CreateOrganizers < ActiveRecord::Migration[8.1]
  def change
    create_table :organizers do |t|
      t.string :username, null: false
      t.string :password_digest, null: false
      t.string :token

      t.timestamps
    end
    add_index :organizers, :username, unique: true
    add_index :organizers, :token, unique: true
  end
end
