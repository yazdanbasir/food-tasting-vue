class SubmissionIngredient < ApplicationRecord
  belongs_to :submission
  belongs_to :ingredient

  validates :quantity, numericality: { only_integer: true, greater_than: 0 }
end
