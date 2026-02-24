class GroceryCheckin < ApplicationRecord
  belongs_to :ingredient

  validates :quantity_override, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
end
