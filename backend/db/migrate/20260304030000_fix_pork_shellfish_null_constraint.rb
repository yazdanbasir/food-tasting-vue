class FixPorkShellfishNullConstraint < ActiveRecord::Migration[8.1]
  def change
    change_column_null :ingredients, :pork, false, false
    change_column_null :ingredients, :shellfish, false, false
  end
end
