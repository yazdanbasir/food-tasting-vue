class Submission < ApplicationRecord
  has_many :submission_ingredients, dependent: :destroy
  has_many :ingredients, through: :submission_ingredients

  serialize :members, coder: JSON

  validates :dish_name, presence: true
end
