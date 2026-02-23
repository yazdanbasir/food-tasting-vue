class CreateSubmissionIngredients < ActiveRecord::Migration[8.1]
  def change
    create_table :submission_ingredients do |t|
      t.references :submission, null: false, foreign_key: true
      t.references :ingredient, null: false, foreign_key: true
      t.integer :quantity, null: false, default: 1

      t.timestamps
    end
  end
end
