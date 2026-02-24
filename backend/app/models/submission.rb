class Submission < ApplicationRecord
  has_many :submission_ingredients, dependent: :destroy
  has_many :ingredients, through: :submission_ingredients

  serialize :members, coder: JSON

  validates :dish_name, presence: true
  validates :access_code, presence: true, uniqueness: true

  before_validation :generate_access_code, on: :create

  private

  def generate_access_code
    loop do
      self.access_code = SecureRandom.alphanumeric(8).upcase
      break unless Submission.exists?(access_code: access_code)
    end
  end
end
