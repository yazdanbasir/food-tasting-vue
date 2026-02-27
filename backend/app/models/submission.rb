class Submission < ApplicationRecord
  has_many :submission_ingredients, dependent: :destroy
  has_many :ingredients, through: :submission_ingredients

  serialize :members, coder: JSON

  validates :dish_name, presence: true

  def needs_fridge_space?
    needs_fridge_space == "yes"
  end
end
